"""
Rule Engine Service
Evaluates ncl_rule_definitions for a form against current field values and
returns the set of actions that should be applied.

Condition operators:
  eq, neq, gt, gte, lt, lte, contains, not_contains,
  in, not_in, empty, not_empty, between, matches_pattern

Action types by rule_type:
  visibility   — show | hide  (target = field_name or section_id)
  validation   — require | unrequire | set_error | clear_error
  calculation  — compute  (target = field_name, expression = formula string)
  notification — notify   (message, level: info|warning|error)
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from app.api.config.db_config import get_db_connection

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Operator evaluation
# ─────────────────────────────────────────────────────────────────────────────

def _coerce(value: Any) -> Any:
    """Try numeric coercion so '5' == 5 comparisons work."""
    if isinstance(value, str):
        try:
            return float(value) if '.' in value else int(value)
        except (ValueError, TypeError):
            pass
    return value


def _eval_condition(condition: dict, values: dict) -> bool:
    """Evaluate a single condition dict against the current form values."""
    field    = condition.get("field")
    operator = condition.get("operator", "eq")
    expected = condition.get("value")

    actual = values.get(field) if field else None

    if operator == "empty":
        return actual is None or actual == "" or actual == [] or actual is False

    if operator == "not_empty":
        return not (actual is None or actual == "" or actual == [] or actual is False)

    # For ordered/equality operators coerce to numbers when possible
    actual_c   = _coerce(actual)
    expected_c = _coerce(expected)

    if operator == "eq":
        return actual_c == expected_c or str(actual or "").lower() == str(expected or "").lower()
    if operator == "neq":
        return actual_c != expected_c
    if operator == "gt":
        try:    return float(actual_c) > float(expected_c)
        except: return False
    if operator == "gte":
        try:    return float(actual_c) >= float(expected_c)
        except: return False
    if operator == "lt":
        try:    return float(actual_c) < float(expected_c)
        except: return False
    if operator == "lte":
        try:    return float(actual_c) <= float(expected_c)
        except: return False
    if operator == "contains":
        if isinstance(actual, list):
            return expected in actual
        return expected and expected.lower() in str(actual or "").lower()
    if operator == "not_contains":
        if isinstance(actual, list):
            return expected not in actual
        return not (expected and expected.lower() in str(actual or "").lower())
    if operator == "in":
        items = expected if isinstance(expected, list) else str(expected or "").split(",")
        items = [str(i).strip().lower() for i in items]
        return str(actual or "").lower() in items
    if operator == "not_in":
        items = expected if isinstance(expected, list) else str(expected or "").split(",")
        items = [str(i).strip().lower() for i in items]
        return str(actual or "").lower() not in items
    if operator == "between":
        lo, hi = (expected or [None, None])[:2] if isinstance(expected, list) else [None, None]
        try:    return float(lo) <= float(actual_c) <= float(hi)
        except: return False
    if operator == "matches_pattern":
        try:    return bool(re.match(str(expected), str(actual or "")))
        except: return False

    return False


def _eval_condition_group(conditions: List[dict], values: dict, logic: str = "and") -> bool:
    """Evaluate a list of conditions with AND or OR logic."""
    if not conditions:
        return True
    results = [_eval_condition(c, values) for c in conditions]
    return all(results) if logic.lower() != "or" else any(results)


# ─────────────────────────────────────────────────────────────────────────────
# Formula / expression evaluation (calculation rules)
# ─────────────────────────────────────────────────────────────────────────────

def _safe_eval_formula(expression: str, values: dict) -> Optional[Any]:
    """
    Evaluate a simple arithmetic formula that may reference field names.
    Supports: +, -, *, /, (, ), numeric literals, and field name tokens.
    Returns None if evaluation fails.
    """
    if not expression:
        return None

    # Replace field name tokens with their numeric values
    token_re = re.compile(r'\b([a-zA-Z_][a-zA-Z0-9_]*)\b')

    def replace_field(match: re.Match) -> str:
        name = match.group(1)
        val  = values.get(name)
        try:
            return str(float(val))
        except (TypeError, ValueError):
            return "0"

    expr = token_re.sub(replace_field, expression)

    # Allow only safe characters
    if not re.match(r'^[\d\s\+\-\*/\(\)\.\,]+$', expr):
        return None

    try:
        result = eval(expr, {"__builtins__": {}})  # noqa: S307 — safe: only arithmetic
        return result
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Main service class
# ─────────────────────────────────────────────────────────────────────────────

class RuleEngineService:

    # ── DB helpers ──────────────────────────────────────────────────────────

    def _load_rules(self, form_id: str) -> List[dict]:
        sql = """
            SELECT id, name, rule_type, trigger_fields,
                   conditions, actions, priority, is_active
            FROM   ncl_rule_definitions
            WHERE  form_id = %s
              AND  is_active = TRUE
            ORDER  BY priority ASC, created_at ASC
        """
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, (form_id,))
                rows = cur.fetchall()

        result = []
        for row in rows:
            (rid, name, rule_type, trigger_fields_raw,
             conditions_raw, actions_raw, priority, is_active) = row
            result.append({
                "id":             str(rid),
                "name":           name,
                "rule_type":      rule_type,
                "trigger_fields": self._parse_jsonb(trigger_fields_raw, []),
                "conditions":     self._parse_jsonb(conditions_raw, []),
                "actions":        self._parse_jsonb(actions_raw, []),
                "priority":       priority,
            })
        return result

    @staticmethod
    def _parse_jsonb(val: Any, default: Any) -> Any:
        if val is None:
            return default
        if isinstance(val, (dict, list)):
            return val
        try:
            return json.loads(val)
        except Exception:
            return default

    # ── Public API ──────────────────────────────────────────────────────────

    def evaluate(self, form_id: str, values: dict, changed_fields: Optional[List[str]] = None) -> dict:
        """
        Evaluate all active rules for `form_id` against `values`.

        Parameters
        ----------
        form_id        : form UUID
        values         : current field name → value map
        changed_fields : if supplied, only rules whose trigger_fields
                         intersect with changed_fields are re-evaluated
                         (optimization for real-time evaluation on change)

        Returns
        -------
        {
          "fired_rules": [{ id, name, rule_type, actions_applied }],
          "field_states": { field_name: { visible, required, error, value } },
          "notifications": [{ message, level }],
        }
        """
        rules = self._load_rules(form_id)

        fired_rules:   List[dict] = []
        field_states:  Dict[str, dict] = {}
        notifications: List[dict] = []

        for rule in rules:
            # Trigger-field filter — skip rules not triggered by changed fields
            if changed_fields is not None and rule["trigger_fields"]:
                if not any(f in changed_fields for f in rule["trigger_fields"]):
                    continue

            # Evaluate conditions (rule-level logic_operator defaults to "and")
            logic    = rule.get("logic_operator", "and")
            conditions: List[dict] = rule["conditions"]

            # Support nested condition groups: [{group: [{...}], logic: "or"}]
            matched = self._eval_conditions_tree(conditions, values, logic)

            if not matched:
                continue

            # Rule fired — apply its actions
            applied = []
            for action in rule["actions"]:
                result = self._apply_action(rule["rule_type"], action, values, field_states, notifications)
                if result:
                    applied.append(result)

            fired_rules.append({
                "id":              rule["id"],
                "name":            rule["name"],
                "rule_type":       rule["rule_type"],
                "actions_applied": applied,
            })

        return {
            "fired_rules":  fired_rules,
            "field_states": field_states,
            "notifications": notifications,
        }

    def _eval_conditions_tree(self, conditions: List[dict], values: dict, logic: str) -> bool:
        """Supports flat list and nested {group, logic} structures."""
        if not conditions:
            return True

        flat   = []
        groups = []

        for c in conditions:
            if "group" in c:
                # Nested group
                sub_logic = c.get("logic", "and")
                groups.append(_eval_condition_group(c["group"], values, sub_logic))
            else:
                flat.append(_eval_condition(c, values))

        all_results = flat + groups
        if not all_results:
            return True
        return all(all_results) if logic.lower() != "or" else any(all_results)

    def _apply_action(
        self,
        rule_type: str,
        action: dict,
        values: dict,
        field_states: dict,
        notifications: list,
    ) -> Optional[dict]:
        """Apply a single action and mutate field_states / notifications in place."""
        atype  = action.get("type")
        target = action.get("target")

        if rule_type == "visibility":
            if target and atype in ("show", "hide"):
                fs = field_states.setdefault(target, {})
                fs["visible"] = (atype == "show")
                return {"type": atype, "target": target}

        elif rule_type == "validation":
            if atype == "require" and target:
                fs = field_states.setdefault(target, {})
                fs["required"] = True
                return {"type": "require", "target": target}
            if atype == "unrequire" and target:
                fs = field_states.setdefault(target, {})
                fs["required"] = False
                return {"type": "unrequire", "target": target}
            if atype == "set_error" and target:
                fs = field_states.setdefault(target, {})
                fs["error"] = action.get("message", "Validation failed")
                return {"type": "set_error", "target": target, "message": fs["error"]}
            if atype == "clear_error" and target:
                fs = field_states.setdefault(target, {})
                fs.pop("error", None)
                return {"type": "clear_error", "target": target}

        elif rule_type == "calculation":
            if atype == "compute" and target:
                expr   = action.get("expression", "")
                result = _safe_eval_formula(expr, values)
                if result is not None:
                    fs = field_states.setdefault(target, {})
                    fs["value"] = result
                    return {"type": "compute", "target": target, "value": result}

        elif rule_type == "notification":
            if atype == "notify":
                msg = action.get("message", "")
                lvl = action.get("level", "info")
                notifications.append({"message": msg, "level": lvl})
                return {"type": "notify", "message": msg, "level": lvl}

        return None

    # ── Validation helper (server-side, called on submit) ──────────────────

    def validate_submission(self, form_id: str, values: dict) -> List[dict]:
        """
        Run the rule engine and return validation errors to block submission.
        Returns a list of {field, message} dicts; empty list = valid.
        """
        result = self.evaluate(form_id, values)
        errors = []

        for field_name, state in result["field_states"].items():
            if "error" in state:
                errors.append({"field": field_name, "message": state["error"]})
            # Required field check
            if state.get("required") and (values.get(field_name) in (None, "", [])):
                errors.append({"field": field_name, "message": "This field is required"})

        return errors
