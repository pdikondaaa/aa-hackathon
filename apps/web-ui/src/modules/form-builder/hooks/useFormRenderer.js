import { useState, useCallback, useEffect, useRef } from 'react';
import { NON_DATA_TYPES } from '../constants/fieldTypes';
import { evaluateFormRules, validateFormRules } from '../services/formBuilderApi';

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evalOperator(op, fieldVal, ruleVal) {
  const fv = fieldVal === undefined || fieldVal === null ? '' : fieldVal;
  switch (op) {
    case 'eq':        return String(fv) === String(ruleVal);
    case 'neq':       return String(fv) !== String(ruleVal);
    case 'gt':        return Number(fv) > Number(ruleVal);
    case 'gte':       return Number(fv) >= Number(ruleVal);
    case 'lt':        return Number(fv) < Number(ruleVal);
    case 'lte':       return Number(fv) <= Number(ruleVal);
    case 'contains':  return String(fv).toLowerCase().includes(String(ruleVal).toLowerCase());
    case 'empty':     return !fv || String(fv).trim() === '';
    case 'not_empty': return !!fv && String(fv).trim() !== '';
    default:          return false;
  }
}

function evaluateCondition(when, values) {
  return evalOperator(when.op || when.operator, values[when.field], when.value);
}

function applyConditionalLogic(field, values) {
  const logic = field.conditional_logic || [];
  let visible = !field.hidden;
  let required = field.required;

  for (const rule of logic) {
    const { when, then } = rule;
    if (!when || !then) continue;
    const match = evaluateCondition(when, values);
    if (!match) continue;

    if (then.action === 'show')      visible = true;
    if (then.action === 'hide')      visible = false;
    if (then.action === 'require')   required = true;
    if (then.action === 'unrequire') required = false;
  }

  return { visible, required };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateField(field, value, required) {
  if (NON_DATA_TYPES.includes(field.field_type)) return null;

  const isEmpty = value === undefined || value === null || String(value).trim() === '';
  if (required && isEmpty) return field.validation_rules?.custom_message || `${field.label} is required`;
  if (isEmpty) return null;

  const rules = field.validation_rules || {};
  const v = String(value);

  if (rules.min_length && v.length < rules.min_length)
    return `Minimum ${rules.min_length} characters required`;
  if (rules.max_length && v.length > rules.max_length)
    return `Maximum ${rules.max_length} characters allowed`;
  if (rules.min !== undefined && Number(value) < rules.min)
    return `Minimum value is ${rules.min}`;
  if (rules.max !== undefined && Number(value) > rules.max)
    return `Maximum value is ${rules.max}`;
  if (rules.pattern && !new RegExp(rules.pattern).test(v))
    return rules.custom_message || 'Invalid format';

  // Built-in type validation
  if (field.field_type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    return 'Invalid email address';
  if (field.field_type === 'url') {
    try { new URL(v); } catch { return 'Invalid URL'; }
  }
  if (field.field_type === 'phone' && !/^[\d\s\-+()]{7,15}$/.test(v))
    return 'Invalid phone number';

  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useFormRenderer(form, prefill = {}, onSubmit) {
  const [values, setValues]   = useState({});
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);

  // Server-side rule engine state
  const [serverFieldStates, setServerFieldStates] = useState({});
  const [notifications, setNotifications]         = useState([]);
  const debounceRef = useRef(null);

  // Initialise with defaults + prefill
  useEffect(() => {
    if (!form) return;
    const init = {};
    for (const field of (form.fields || [])) {
      if (NON_DATA_TYPES.includes(field.field_type)) continue;
      init[field.name] = prefill[field.name] ?? field.default_value ?? '';
    }
    setValues(init);
  }, [form]);

  // Call rule engine on value changes (debounced 300ms)
  useEffect(() => {
    const formId = form?.id;
    if (!formId || formId === 'preview') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await evaluateFormRules(formId, values);
        if (result?.field_states) setServerFieldStates(result.field_states);
        if (result?.notifications) setNotifications(result.notifications);
        // Apply computed values from calculation rules
        if (result?.field_states) {
          const computed = {};
          for (const [name, state] of Object.entries(result.field_states)) {
            if (state.value !== undefined) computed[name] = state.value;
          }
          if (Object.keys(computed).length > 0) {
            setValues(prev => ({ ...prev, ...computed }));
          }
        }
      } catch {
        // Rule evaluation failures are non-fatal; continue with client-side only
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, form?.id]);

  const setValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: null }));
  }, []);

  const touchField = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  // Merge client-side conditional logic + server-side rule engine states
  const fieldStates = {};
  for (const field of (form?.fields || [])) {
    const clientState  = applyConditionalLogic(field, values);
    const serverState  = serverFieldStates[field.name] || {};
    fieldStates[field.id] = {
      visible:  serverState.visible  !== undefined ? serverState.visible  : clientState.visible,
      required: serverState.required !== undefined ? serverState.required : clientState.required,
      error:    serverState.error    || null,
    };
  }

  const validate = useCallback(() => {
    const errs = {};
    for (const field of (form?.fields || [])) {
      const state = fieldStates[field.id];
      if (!state?.visible) continue;
      // Prefer server-injected error over client-side validation
      const serverErr = state.error;
      const clientErr = validateField(field, values[field.name], state.required);
      const err = serverErr || clientErr;
      if (err) errs[field.name] = err;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, values, fieldStates]);

  const handleSubmit = useCallback(async (meta = {}) => {
    const allTouched = {};
    for (const f of (form?.fields || [])) allTouched[f.name] = true;
    setTouched(allTouched);

    if (!validate()) return false;

    // Server-side rule validation before submission
    const formId = form?.id;
    if (formId && formId !== 'preview') {
      try {
        const ruleResult = await validateFormRules(formId, values);
        if (!ruleResult?.valid && ruleResult?.errors?.length) {
          const errs = {};
          for (const { field, message } of ruleResult.errors) {
            errs[field] = message;
          }
          setErrors(prev => ({ ...prev, ...errs }));
          return false;
        }
      } catch {
        // Non-fatal: proceed to submit if rule validation call fails
      }
    }

    setSubmitting(true);
    try {
      const submitData = {};
      for (const field of (form?.fields || [])) {
        if (NON_DATA_TYPES.includes(field.field_type)) continue;
        if (!fieldStates[field.id]?.visible) continue;
        submitData[field.name] = values[field.name] ?? null;
      }
      await onSubmit({ data: submitData, metadata: meta });
      setSubmitted(true);
      return true;
    } catch (e) {
      setErrors(prev => ({ ...prev, _form: e.message || 'Submission failed' }));
      return false;
    } finally {
      setSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, values, validate, onSubmit]);

  const reset = useCallback(() => {
    setValues({});
    setErrors({});
    setTouched({});
    setSubmitted(false);
    setSubmitting(false);
    setServerFieldStates({});
    setNotifications([]);
  }, []);

  return {
    values, errors, touched, fieldStates,
    submitting, submitted,
    notifications,
    setValue, touchField, handleSubmit, validate, reset,
  };
}
