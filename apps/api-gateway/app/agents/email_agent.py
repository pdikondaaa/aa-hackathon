"""
Email Agent — refines email drafts by calling the Ollama REST API directly.
Uses requests (no LangChain dependency) to avoid singleton/init issues.
"""
import os
import re
import requests
from typing import Optional

_SYSTEM_PROMPT = (
    "You are an expert professional email writing assistant for Aligned Automation. "
    "Refine the draft below to be clear, concise, and professional while keeping "
    "every piece of the original intent and information.\n\n"
    "Rules:\n"
    "- Preserve all key facts — do NOT invent new information\n"
    "- Use a professional but warm tone\n"
    "- Fix grammar, punctuation, and structure\n"
    "- Make the subject line specific and actionable\n"
    "- Return ONLY the refined email — no commentary, no preamble\n\n"
    "Return your response in EXACTLY this format:\n"
    "SUBJECT: [refined subject line]\n"
    "BODY:\n"
    "[refined email body]"
)

def _get_from_chat_system_prompt() -> str:
    email_it    = os.environ.get("ESCALATION_EMAIL_IT",    "it.support@alignedautomation.com")
    email_hr    = os.environ.get("ESCALATION_EMAIL_HR",    "hr@alignedautomation.com")
    email_admin = os.environ.get("ESCALATION_EMAIL_ADMIN", "admin@alignedautomation.com")
    email_org   = os.environ.get("ESCALATION_EMAIL_ORG",   "management@alignedautomation.com")
    return (
        "You are an AI assistant for Aligned Automation that helps employees draft professional emails "
        "based on their chat requests. Understand the employee's intent and write a complete, "
        "professional email on their behalf.\n\n"
        "Default recipients by request type:\n"
        f"- Software installation / IT support / laptop issues / access requests → {email_it}\n"
        f"- Sick leave / medical leave / feeling unwell → {email_hr}\n"
        f"- HR matters / general leave → {email_hr}\n"
        f"- Admin / policy / compliance / facilities → {email_admin}\n"
        f"- Organisation / management matters → {email_org}\n"
        "- Unknown recipient → leave the TO field blank\n\n"
        "Rules:\n"
        "- Keep the email concise and professional (3-5 sentences for the body)\n"
        "- Use a warm but formal tone — signed off as 'Regards'\n"
        "- Do NOT invent facts not mentioned by the user\n"
        "- Return ONLY the formatted email — no commentary, no preamble\n\n"
        "Return in EXACTLY this format:\n"
        "TO: [recipient email address]\n"
        "SUBJECT: [subject line]\n"
        "BODY:\n"
        "[full email body]"
    )


def _ollama_base_url() -> str:
    return os.environ.get("OLLAMA_BASE_URL", "http://ml01.alignedautomation.com:11434")


def _ollama_model() -> str:
    return os.environ.get("OLLAMA_MODEL", "gpt-oss")


def _call_ollama(user_content: str, system_prompt: str = None) -> str:
    url = f"{_ollama_base_url()}/api/chat"
    payload = {
        "model": _ollama_model(),
        "messages": [
            {"role": "system", "content": system_prompt or _SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ],
        "stream": False,
    }
    resp = requests.post(url, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    # Ollama /api/chat response: {"message": {"role": "assistant", "content": "..."}}
    return data["message"]["content"]


def _parse_response(text: str, fallback_subject: str) -> dict:
    subject_match = re.search(r"^SUBJECT:\s*(.+?)$", text, re.MULTILINE | re.IGNORECASE)
    body_match    = re.search(r"^BODY:\s*\n([\s\S]+)",  text, re.MULTILINE | re.IGNORECASE)
    return {
        "refined_subject": subject_match.group(1).strip() if subject_match else fallback_subject,
        "refined_body":    body_match.group(1).strip()    if body_match    else text.strip(),
    }


def _parse_from_chat_response(text: str) -> dict:
    to_match      = re.search(r"^TO:\s*(.+?)$",      text, re.MULTILINE | re.IGNORECASE)
    subject_match = re.search(r"^SUBJECT:\s*(.+?)$", text, re.MULTILINE | re.IGNORECASE)
    body_match    = re.search(r"^BODY:\s*\n([\s\S]+)", text, re.MULTILINE | re.IGNORECASE)
    return {
        "to":              (to_match.group(1).strip()      if to_match      else ""),
        "refined_subject": (subject_match.group(1).strip() if subject_match else ""),
        "refined_body":    (body_match.group(1).strip()    if body_match    else text.strip()),
    }


def draft_email_from_chat(message: str) -> dict:
    """
    Uses the LLM to draft a professional email from a plain-language chat request.
    Returns {"to": str, "refined_subject": str, "refined_body": str}.
    Raises RuntimeError on failure.
    """
    user_content = f"Draft a professional email based on this employee request:\n\n\"{message.strip()}\""
    try:
        raw = _call_ollama(user_content, system_prompt=_get_from_chat_system_prompt())
        return _parse_from_chat_response(raw)
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot reach the LLM server at {_ollama_base_url()}. "
            "Please check the OLLAMA_BASE_URL environment variable."
        )
    except requests.exceptions.Timeout:
        raise RuntimeError("LLM request timed out after 120 seconds.")
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"LLM server returned an error: {exc}") from exc
    except (KeyError, ValueError) as exc:
        raise RuntimeError(f"Unexpected response format from LLM: {exc}") from exc


def refine_email_draft(to: str, cc: Optional[str], subject: str, body: str) -> dict:
    """
    Calls the local Ollama LLM to refine an email draft.
    Returns {"refined_subject": str, "refined_body": str}.
    Raises RuntimeError on failure.
    """
    lines = [f"To: {to or '(not specified)'}"]
    if cc:
        lines.append(f"CC: {cc}")
    lines += [f"Subject: {subject or '(not specified)'}", "", body.strip()]
    user_content = "Please refine this email draft:\n\n" + "\n".join(lines)

    try:
        raw = _call_ollama(user_content)
        return _parse_response(raw, subject)
    except requests.exceptions.ConnectionError:
        raise RuntimeError(
            f"Cannot reach the LLM server at {_ollama_base_url()}. "
            "Please check the OLLAMA_BASE_URL environment variable."
        )
    except requests.exceptions.Timeout:
        raise RuntimeError("LLM request timed out after 120 seconds.")
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"LLM server returned an error: {exc}") from exc
    except (KeyError, ValueError) as exc:
        raise RuntimeError(f"Unexpected response format from LLM: {exc}") from exc
