"""
Document Agent — Generates professional HR/corporate documents dynamically.
Supports multi-turn conversation to collect required fields before generating.
Session state is maintained in-memory, keyed by user_email.
"""

import os
import re
import json
import requests
from datetime import date, datetime
from typing import Dict, List, Optional

# ── LLM helpers ───────────────────────────────────────────────────────────────

def _ollama_base_url() -> str:
    return os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434")

def _ollama_model() -> str:
    return os.environ.get("OLLAMA_MODEL", "gpt-oss")

def _call_llm(user_content: str, system_prompt: str, max_tokens: int = 2048) -> str:
    url = f"{_ollama_base_url()}/api/chat"
    payload = {
        "model": _ollama_model(),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "stream": False,
        "options": {"num_predict": max_tokens},
    }
    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()["message"]["content"]

# ── Document catalogue ────────────────────────────────────────────────────────

DOCUMENT_TYPES: Dict[str, dict] = {
    "loan_proof": {
        "aliases": [
            "loan proof", "loan letter", "loan verification", "loan document",
            "home loan letter", "personal loan letter", "bank loan letter",
        ],
        "name": "Loan Proof / Employment Verification Letter",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "department":     "Department",
            "designation":    "Designation / Job Title",
            "salary":         "Monthly/Annual Salary (e.g., ₹50,000 per month or ₹6 LPA)",
            "joining_date":   "Date of Joining",
            "purpose":        "Purpose of Letter (e.g., Home Loan, Personal Loan)",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
    "experience_letter": {
        "aliases": [
            "experience letter", "experience certificate", "service letter",
            "work experience letter", "relieving cum experience",
        ],
        "name": "Experience Letter",
        "required_fields": {
            "employee_name":     "Employee Full Name",
            "joining_date":      "Date of Joining",
            "last_working_date": "Last Working Date",
            "designation":       "Designation / Job Title",
            "department":        "Department",
            "company_name":      "Company Name",
            "reporting_manager": "Reporting Manager Name",
            "signatory_name":    "Authorized Signatory Name & Designation",
        },
    },
    "employment_verification": {
        "aliases": [
            "employment verification", "employment certificate",
            "employment proof", "verification of employment",
        ],
        "name": "Employment Verification Letter",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "department":     "Department",
            "designation":    "Designation / Job Title",
            "joining_date":   "Date of Joining",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
    "offer_letter": {
        "aliases": [
            "offer letter", "job offer", "appointment letter", "employment offer",
        ],
        "name": "Offer Letter",
        "required_fields": {
            "candidate_name":   "Candidate Full Name",
            "designation":      "Designation / Job Title",
            "department":       "Department",
            "joining_date":     "Proposed Date of Joining",
            "salary":           "Offered CTC / Salary Package",
            "reporting_manager": "Reporting Manager Name",
            "company_name":     "Company Name",
            "signatory_name":   "Authorized Signatory Name & Designation",
            "offer_valid_till": "Offer Valid Till Date",
        },
    },
    "relieving_letter": {
        "aliases": [
            "relieving letter", "relieving certificate", "no dues letter",
            "relieving cum experience letter",
        ],
        "name": "Relieving Letter",
        "required_fields": {
            "employee_name":     "Employee Full Name",
            "employee_id":       "Employee ID",
            "designation":       "Designation / Job Title",
            "department":        "Department",
            "joining_date":      "Date of Joining",
            "last_working_date": "Last Working Date",
            "company_name":      "Company Name",
            "signatory_name":    "Authorized Signatory Name & Designation",
        },
    },
    "address_proof": {
        "aliases": [
            "address proof", "address letter", "address verification", "address certificate",
        ],
        "name": "Address Proof Letter",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "designation":    "Designation / Job Title",
            "address":        "Complete Residential Address",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
    "bonafide": {
        "aliases": [
            "bonafide", "bona fide", "bonafide letter", "bonafide certificate", "bonafide cert",
        ],
        "name": "Bonafide Certificate",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "designation":    "Designation / Job Title",
            "department":     "Department",
            "joining_date":   "Date of Joining",
            "purpose":        "Purpose (e.g., Visa Application, Bank Account Opening)",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
    "internship_certificate": {
        "aliases": [
            "internship certificate", "internship letter", "internship completion",
            "intern certificate", "internship completion certificate",
        ],
        "name": "Internship Completion Certificate",
        "required_fields": {
            "intern_name":       "Intern Full Name",
            "college":           "College / University Name",
            "department":        "Department",
            "internship_start":  "Internship Start Date",
            "internship_end":    "Internship End Date",
            "project":           "Project / Area of Work",
            "company_name":      "Company Name",
            "signatory_name":    "Authorized Signatory Name & Designation",
        },
    },
    "promotion_letter": {
        "aliases": [
            "promotion letter", "promotion certificate", "promotion notification",
            "increment letter", "appraisal letter",
        ],
        "name": "Promotion Letter",
        "required_fields": {
            "employee_name":       "Employee Full Name",
            "employee_id":         "Employee ID",
            "current_designation": "Current Designation",
            "new_designation":     "New Designation",
            "department":          "Department",
            "effective_date":      "Effective Date of Promotion",
            "new_salary":          "Revised Salary / CTC",
            "company_name":        "Company Name",
            "signatory_name":      "Authorized Signatory Name & Designation",
        },
    },
    "noc": {
        "aliases": [
            "noc", "no objection certificate", "no objection letter", "noc letter",
        ],
        "name": "No Objection Certificate (NOC)",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "designation":    "Designation / Job Title",
            "department":     "Department",
            "purpose":        "Purpose of NOC (e.g., Higher Studies, Part-time Work, Travel)",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
    "confirmation_letter": {
        "aliases": [
            "confirmation letter", "employee confirmation", "permanent confirmation",
            "probation completion", "probation confirmation",
        ],
        "name": "Employee Confirmation Letter",
        "required_fields": {
            "employee_name":     "Employee Full Name",
            "employee_id":       "Employee ID",
            "designation":       "Designation / Job Title",
            "department":        "Department",
            "joining_date":      "Date of Joining",
            "confirmation_date": "Date of Confirmation",
            "salary":            "Confirmed Salary / CTC",
            "company_name":      "Company Name",
            "signatory_name":    "Authorized Signatory Name & Designation",
        },
    },
    "id_card_request": {
        "aliases": [
            "id card request", "identity card request", "employee id card",
            "id card replacement", "new id card",
        ],
        "name": "ID Card Request Letter",
        "required_fields": {
            "employee_name":  "Employee Full Name",
            "employee_id":    "Employee ID",
            "designation":    "Designation / Job Title",
            "department":     "Department",
            "reason":         "Reason for Request (Lost / Damaged / New Joining)",
            "company_name":   "Company Name",
            "signatory_name": "Authorized Signatory Name & Designation",
        },
    },
}

_SUPPORTED_DOCS_LIST = "\n".join(
    f"  • **{info['name']}**" for info in DOCUMENT_TYPES.values()
)

# ── Session state ─────────────────────────────────────────────────────────────

_sessions: Dict[str, dict] = {}
_SESSION_TIMEOUT_MINUTES = 30


def _session_key(user_email: str, user_id: str) -> str:
    """Prefer email; fall back to user_id so session works even when email is absent."""
    return user_email or user_id or ""


def has_active_session(user_email: str, user_id: str = "") -> bool:
    """Return True if this user has an active (non-expired) document session."""
    key = _session_key(user_email, user_id)
    if not key or key not in _sessions:
        return False
    s = _sessions[key]
    if (datetime.now() - s["last_updated"]).total_seconds() / 60 > _SESSION_TIMEOUT_MINUTES:
        del _sessions[key]
        return False
    return True

# ── Reset/cancel pattern ──────────────────────────────────────────────────────

_CANCEL_RE = re.compile(
    r"\b(?:cancel|stop|quit|exit|abort|reset|start\s+over|new\s+document|different\s+document|never\s+mind)\b",
    re.IGNORECASE,
)

# ── Document type detection ───────────────────────────────────────────────────

_DOC_DETECT_SYSTEM = """\
You are a document type classifier for an HR document generation system.

Available document type keys:
  loan_proof, experience_letter, employment_verification, offer_letter,
  relieving_letter, address_proof, bonafide, internship_certificate,
  promotion_letter, noc, confirmation_letter, id_card_request, custom

Based on the user's request, identify the best matching document type.
Reply with ONLY the key (e.g., loan_proof). No explanation, no punctuation."""


def _detect_doc_type_keyword(query: str) -> Optional[str]:
    q = query.lower()
    best_key, best_len = None, 0
    for doc_key, doc_info in DOCUMENT_TYPES.items():
        for alias in doc_info["aliases"]:
            if alias in q and len(alias) > best_len:
                best_key, best_len = doc_key, len(alias)
    return best_key


def _detect_doc_type_llm(query: str) -> Optional[str]:
    try:
        result = _call_llm(query, _DOC_DETECT_SYSTEM, max_tokens=20)
        token = result.strip().lower().split()[0] if result.strip() else ""
        if token in DOCUMENT_TYPES or token == "custom":
            return token
    except Exception as exc:
        print(f"[DocumentAgent] LLM doc-type detection error: {exc}")
    return None


def _detect_doc_type(query: str) -> Optional[str]:
    detected = _detect_doc_type_keyword(query)
    return detected if detected else _detect_doc_type_llm(query)

# ── Field extraction ──────────────────────────────────────────────────────────

def _build_extract_system(required_fields: Dict[str, str]) -> str:
    fields_desc = "\n".join(f"  - {k}: {v}" for k, v in required_fields.items())
    return (
        "You are a precise information extraction assistant.\n"
        "Extract the following fields from the user's message.\n"
        "Return a JSON object with ONLY the fields explicitly mentioned.\n"
        "Do NOT guess, infer, or hallucinate values.\n"
        "If a field is not mentioned, omit it.\n\n"
        f"Fields:\n{fields_desc}\n\n"
        'Return ONLY valid JSON. Example: {"employee_name": "John Doe"}\n'
        'If nothing can be extracted, return: {}'
    )


def _extract_fields(message: str, required_fields: Dict[str, str]) -> Dict[str, str]:
    try:
        system = _build_extract_system(required_fields)
        result = _call_llm(message, system, max_tokens=512)
        json_match = re.search(r"\{[^{}]*\}", result, re.DOTALL)
        if json_match:
            extracted = json.loads(json_match.group())
            return {k: str(v) for k, v in extracted.items() if k in required_fields and v}
    except Exception as exc:
        print(f"[DocumentAgent] Field extraction error: {exc}")
    return {}

# ── Document generation ───────────────────────────────────────────────────────

def _build_gen_system(doc_name: str) -> str:
    today = date.today().strftime("%B %d, %Y")
    year = date.today().year
    return (
        f"You are a professional HR document specialist for Aligned Automation.\n"
        f"Generate a complete, formal {doc_name} using the provided details.\n\n"
        f"Today's date: {today}\n\n"
        "Document format (strict):\n"
        "1. Company name — centered at top\n"
        f"2. Document title — centered, bold\n"
        f"3. Reference: REF/{year}/[4-digit number]\n"
        "4. Date\n"
        "5. 'To Whomsoever It May Concern' (or specific recipient)\n"
        "6. Subject line (bold)\n"
        "7. Formal body — 2-4 paragraphs using professional corporate English\n"
        "8. Closing line\n"
        "9. Signature block:\n"
        "   Authorized Signatory\n"
        "   [Signatory Name]\n"
        "   [Signatory Designation]\n"
        "   [Company Name]\n"
        "   (Company Seal)\n\n"
        "Rules:\n"
        "- Use only the provided values — never leave blanks or invent information\n"
        "- Write in clean markdown suitable for PDF conversion\n"
        "- Be precise, formal, and concise\n"
        "Generate ONLY the document. No preamble or commentary."
    )


_SIMPLE_GEN_SYSTEM = (
    "You are an HR document writer. Write a complete, formal business letter "
    "using the details provided. Include: company name at top, document title, "
    "today's date, 'To Whomsoever It May Concern', subject line, 2-3 body paragraphs, "
    "and a signature block. Use markdown formatting."
)


def _clean_html(text: str) -> str:
    """Convert common HTML tags to markdown equivalents, strip the rest."""
    # Bold / strong → **text**
    text = re.sub(r'<(?:b|strong)\b[^>]*>(.*?)</(?:b|strong)>', r'**\1**', text, flags=re.IGNORECASE | re.DOTALL)
    # Italic / em → _text_
    text = re.sub(r'<(?:i|em)\b[^>]*>(.*?)</(?:i|em)>', r'_\1_', text, flags=re.IGNORECASE | re.DOTALL)
    # Headings h1-h3 → # / ## / ###
    text = re.sub(r'<h1\b[^>]*>(.*?)</h1>', r'# \1', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<h2\b[^>]*>(.*?)</h2>', r'## \1', text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'<h3\b[^>]*>(.*?)</h3>', r'### \1', text, flags=re.IGNORECASE | re.DOTALL)
    # <center>text</center> → text (content itself; headings/titles will center via layout)
    text = re.sub(r'<center\b[^>]*>(.*?)</center>', r'\1', text, flags=re.IGNORECASE | re.DOTALL)
    # <p>text</p> → text + newline
    text = re.sub(r'<p\b[^>]*>(.*?)</p>', r'\1\n', text, flags=re.IGNORECASE | re.DOTALL)
    # <li>text</li> → - text
    text = re.sub(r'<li\b[^>]*>(.*?)</li>', r'- \1', text, flags=re.IGNORECASE | re.DOTALL)
    # <br> or <br/> → newline
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    # <hr> → ---
    text = re.sub(r'<hr\s*/?>', '---', text, flags=re.IGNORECASE)
    # Strip any remaining tags
    text = re.sub(r'<[^>]+>', '', text)
    # Collapse 3+ consecutive blank lines to 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _generate_document(doc_type: str, fields: Dict[str, str]) -> str:
    doc_name = DOCUMENT_TYPES[doc_type]["name"]
    fields_str = "\n".join(f"{k}: {v}" for k, v in fields.items())
    user_content = f"Write a {doc_name} using these details:\n\n{fields_str}"

    # Attempt 1 — full structured system prompt
    try:
        result = _clean_html(_call_llm(user_content, _build_gen_system(doc_name), max_tokens=2048))
        if result:
            return result
        print(f"[DocumentAgent] Empty response on attempt 1 for {doc_type}")
    except Exception as exc:
        print(f"[DocumentAgent] Generation error attempt 1: {exc}")

    # Attempt 2 — simplified system prompt (less restrictive)
    try:
        result = _clean_html(_call_llm(user_content, _SIMPLE_GEN_SYSTEM, max_tokens=2048))
        if result:
            return result
        print(f"[DocumentAgent] Empty response on attempt 2 for {doc_type}")
    except Exception as exc:
        print(f"[DocumentAgent] Generation error attempt 2: {exc}")

    # Final fallback — deterministic template, never empty
    print(f"[DocumentAgent] Using template fallback for {doc_type}")
    return _template_document(doc_type, fields)


def _template_document(doc_type: str, fields: Dict[str, str]) -> str:
    """Deterministic letter template used when the LLM returns empty."""
    import random
    today_str  = date.today().strftime("%B %d, %Y")
    ref_no     = f"REF/{date.today().year}/{random.randint(1000, 9999)}"
    doc_name   = DOCUMENT_TYPES[doc_type]["name"]
    company    = fields.get("company_name", "Aligned Automation")
    sig_raw    = fields.get("signatory_name", "HR Manager")
    sig_parts  = [p.strip() for p in sig_raw.split(",", 1)]
    sig_name   = sig_parts[0]
    sig_desig  = sig_parts[1] if len(sig_parts) > 1 else "HR Manager"

    body = _template_body(doc_type, fields, today_str)

    return (
        f"# {company}\n\n"
        "---\n\n"
        f"## {doc_name}\n\n"
        f"**Ref:** {ref_no}  \n"
        f"**Date:** {today_str}\n\n"
        "To Whomsoever It May Concern,\n\n"
        f"**Subject: {doc_name}**\n\n"
        f"{body}\n\n"
        "Yours faithfully,\n\n"
        "---\n\n"
        f"**{sig_name}**  \n"
        f"{sig_desig}  \n"
        f"{company}\n\n"
        "*(Company Seal)*"
    )


def _template_body(doc_type: str, fields: Dict[str, str], today: str) -> str:
    f = fields  # shorthand
    company = f.get("company_name", "Aligned Automation")

    if doc_type == "loan_proof":
        return (
            f"This is to certify that **{f.get('employee_name', 'the employee')}** "
            f"(Employee ID: {f.get('employee_id', 'N/A')}) is a permanent employee of "
            f"**{company}** since **{f.get('joining_date', 'N/A')}**, currently serving as "
            f"**{f.get('designation', 'N/A')}** in the **{f.get('department', 'N/A')}** department.\n\n"
            f"The gross salary drawn is **{f.get('salary', 'N/A')}**.\n\n"
            f"This letter is issued as proof of employment for the purpose of "
            f"**{f.get('purpose', 'loan application')}**, as requested by the employee. "
            "We confirm that the above details are accurate as per our official records."
        )
    if doc_type == "experience_letter":
        return (
            f"This is to certify that **{f.get('employee_name', 'the employee')}** was employed "
            f"with **{company}** from **{f.get('joining_date', 'N/A')}** to "
            f"**{f.get('last_working_date', 'N/A')}** as **{f.get('designation', 'N/A')}** "
            f"in the **{f.get('department', 'N/A')}** department, "
            f"reporting to **{f.get('reporting_manager', 'N/A')}**.\n\n"
            "During the tenure, the employee demonstrated professionalism, dedication, and a "
            "strong work ethic. Their contributions to the team were valued and appreciated.\n\n"
            f"We wish {f.get('employee_name', 'them')} all the best in future endeavours."
        )
    if doc_type == "relieving_letter":
        return (
            f"This is to confirm that **{f.get('employee_name', 'the employee')}** "
            f"(Employee ID: {f.get('employee_id', 'N/A')}), who was employed as "
            f"**{f.get('designation', 'N/A')}** in the **{f.get('department', 'N/A')}** "
            f"department since **{f.get('joining_date', 'N/A')}**, has been formally "
            f"relieved from their duties effective **{f.get('last_working_date', today)}**.\n\n"
            "All company assets have been returned and dues have been cleared. "
            "The employee is free to seek employment elsewhere.\n\n"
            f"We thank {f.get('employee_name', 'them')} for their service and wish them success."
        )
    if doc_type == "offer_letter":
        return (
            f"We are pleased to offer **{f.get('candidate_name', 'you')}** the position of "
            f"**{f.get('designation', 'N/A')}** in the **{f.get('department', 'N/A')}** "
            f"department at **{company}**, effective **{f.get('joining_date', 'N/A')}**.\n\n"
            f"You will report to **{f.get('reporting_manager', 'N/A')}**. "
            f"The offered compensation package is **{f.get('salary', 'N/A')}** per annum. "
            f"This offer is valid until **{f.get('offer_valid_till', 'N/A')}**.\n\n"
            "Kindly sign and return a copy of this letter as your acceptance."
        )
    if doc_type == "noc":
        return (
            f"This is to certify that **{f.get('employee_name', 'the employee')}** "
            f"(Employee ID: {f.get('employee_id', 'N/A')}), serving as "
            f"**{f.get('designation', 'N/A')}** in the **{f.get('department', 'N/A')}** "
            f"department at **{company}**, has applied for a No Objection Certificate "
            f"for the purpose of **{f.get('purpose', 'N/A')}**.\n\n"
            f"**{company}** has no objection to the above-mentioned activity "
            "provided it does not interfere with the employee's official duties and responsibilities."
        )
    if doc_type == "internship_certificate":
        return (
            f"This is to certify that **{f.get('intern_name', 'the intern')}**, a student of "
            f"**{f.get('college', 'N/A')}**, successfully completed an internship with "
            f"**{company}** in the **{f.get('department', 'N/A')}** department "
            f"from **{f.get('internship_start', 'N/A')}** to **{f.get('internship_end', 'N/A')}**.\n\n"
            f"During this period, the intern worked on **{f.get('project', 'assigned projects')}** "
            "and demonstrated commendable learning ability, initiative, and professional conduct.\n\n"
            "We wish the intern success in their academic and professional career."
        )
    if doc_type == "confirmation_letter":
        return (
            f"We are pleased to confirm the permanent appointment of "
            f"**{f.get('employee_name', 'the employee')}** (Employee ID: {f.get('employee_id', 'N/A')}) "
            f"as **{f.get('designation', 'N/A')}** in the **{f.get('department', 'N/A')}** "
            f"department of **{company}** with effect from "
            f"**{f.get('confirmation_date', today)}**.\n\n"
            f"The employee joined us on **{f.get('joining_date', 'N/A')}** and has successfully "
            f"completed the probationary period. The confirmed CTC is **{f.get('salary', 'N/A')}**.\n\n"
            "All other terms and conditions of employment remain unchanged."
        )
    if doc_type == "promotion_letter":
        return (
            f"We are delighted to inform **{f.get('employee_name', 'you')}** "
            f"(Employee ID: {f.get('employee_id', 'N/A')}) that based on your performance and "
            f"contributions, you have been promoted from **{f.get('current_designation', 'N/A')}** "
            f"to **{f.get('new_designation', 'N/A')}** in the **{f.get('department', 'N/A')}** "
            f"department, effective **{f.get('effective_date', today)}**.\n\n"
            f"Your revised CTC will be **{f.get('new_salary', 'N/A')}** per annum. "
            "We appreciate your dedication and look forward to your continued growth."
        )
    # Generic fallback for all other document types
    field_labels = DOCUMENT_TYPES[doc_type]["required_fields"]
    details = "\n".join(
        f"- **{label}:** {f[k]}"
        for k, label in field_labels.items()
        if k in f and k not in ("company_name", "signatory_name")
    )
    return (
        f"This letter is issued by **{company}** confirming the following details:\n\n"
        f"{details}\n\n"
        "This letter is issued upon request and is accurate as per our official records."
    )

# ── Helpers ───────────────────────────────────────────────────────────────────

def _missing_fields_prompt(doc_name: str, missing: Dict[str, str]) -> str:
    items = "\n".join(f"  - **{label}**" for label in missing.values())
    return (
        f"To generate your **{doc_name}**, please provide the following details:\n\n"
        f"{items}\n\n"
        "You can reply with the details in any format — I'll extract them automatically."
    )

# ── Main Agent ────────────────────────────────────────────────────────────────

class DocumentAgent:
    """
    Conversational agent that collects required fields and generates
    professional HR documents. One active session per user_email.
    """

    last_sources: List[str] = []

    # ── session helpers ──────────────────────────────────────────────────────

    def _get_session(self, key: str) -> Optional[dict]:
        if not key or key not in _sessions:
            return None
        s = _sessions[key]
        if (datetime.now() - s["last_updated"]).total_seconds() / 60 > _SESSION_TIMEOUT_MINUTES:
            del _sessions[key]
            return None
        return s

    def _save_session(self, key: str, doc_type: str, fields: dict) -> None:
        _sessions[key] = {
            "doc_type": doc_type,
            "fields": fields,
            "last_updated": datetime.now(),
        }

    def _clear_session(self, key: str) -> None:
        _sessions.pop(key, None)

    # ── main processing ──────────────────────────────────────────────────────

    def process_query(self, query: str, user_email: str = "", user_id: str = "") -> str:
        q = query.strip()
        key = _session_key(user_email, user_id)

        # Cancel / reset
        if _CANCEL_RE.search(q):
            self._clear_session(key)
            return (
                "Document session cancelled. "
                "Feel free to ask whenever you need another document!"
            )

        session = self._get_session(key)

        # ── continuing an active session ─────────────────────────────────────
        if session:
            doc_type = session["doc_type"]
            doc_info = DOCUMENT_TYPES[doc_type]
            collected = {**session["fields"]}

            new_fields = _extract_fields(q, doc_info["required_fields"])
            collected.update(new_fields)
            self._save_session(key, doc_type, collected)

            missing = {k: v for k, v in doc_info["required_fields"].items()
                       if k not in collected}

            if missing:
                return _missing_fields_prompt(doc_info["name"], missing)

            # All fields collected — generate
            doc = _generate_document(doc_type, collected)
            self._clear_session(key)
            return self._wrap_document(doc_info["name"], doc)

        # ── new request ───────────────────────────────────────────────────────
        doc_type = _detect_doc_type(q)

        if not doc_type:
            return (
                "I'm AURA's **Document Generation Agent**. "
                "I can create professional corporate documents for you.\n\n"
                f"**Supported document types:**\n{_SUPPORTED_DOCS_LIST}\n\n"
                "Which document do you need? Just describe your requirement."
            )

        if doc_type == "custom":
            return (
                "I can help with custom documents too! "
                "Please describe in detail what you need, including the purpose, recipient, "
                "and any specific information to include.\n\n"
                f"Or choose from my supported templates:\n{_SUPPORTED_DOCS_LIST}"
            )

        doc_info = DOCUMENT_TYPES[doc_type]

        # Try to extract fields already present in the initial message
        initial_fields = _extract_fields(q, doc_info["required_fields"])
        missing = {k: v for k, v in doc_info["required_fields"].items()
                   if k not in initial_fields}

        if not missing:
            doc = _generate_document(doc_type, initial_fields)
            return self._wrap_document(doc_info["name"], doc)

        # Save session and ask for missing info
        if key:
            self._save_session(key, doc_type, initial_fields)

        if initial_fields:
            captured = ", ".join(
                f"{doc_info['required_fields'].get(k, k)}: **{v}**"
                for k, v in initial_fields.items()
            )
            return (
                f"I'll generate your **{doc_info['name']}**. "
                f"I've captured: {captured}.\n\n"
                + _missing_fields_prompt(doc_info["name"], missing)
            )

        return _missing_fields_prompt(doc_info["name"], missing)

    @staticmethod
    def _wrap_document(doc_name: str, content: str) -> str:
        return (
            f"Here is your **{doc_name}**:\n\n"
            "---\n\n"
            f"{content}\n\n"
            "---\n\n"
            "_Document generated successfully. Please review before printing or distribution._\n\n"
            "Need any corrections or another document? Just let me know!"
        )


# ── Singleton & convenience function ─────────────────────────────────────────

_document_agent = DocumentAgent()


def document_agent_fn(query: str, user_email: str = "", user_id: str = "") -> str:
    return _document_agent.process_query(query, user_email=user_email, user_id=user_id)
