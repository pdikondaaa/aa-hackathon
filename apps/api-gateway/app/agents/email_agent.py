"""
Email Agent — refines email drafts using the configured LLM provider.
Supports Claude, Groq, or Ollama based on environment flags (USE_Claude_API_Key, etc.).
"""
import os
import re
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
        "- Start the email body with a warm greeting such as 'Hi,' or 'Hello,' or 'Dear [Name],'\n"
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


def _call_llm(user_content: str, system_prompt: str = None) -> str:
    from app.agents.working.config import LLMConfig, create_llm
    cfg = LLMConfig()
    llm = create_llm(temperature=0.3, max_tokens=1024, cfg=cfg)
    result = llm.invoke([
        ("system", system_prompt or _SYSTEM_PROMPT),
        ("human", user_content),
    ])
    return result.content if hasattr(result, "content") else str(result)


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


def send_email(to: str, subject: str, body: str, sender: str = "") -> None:
    """
    Sends an email via SMTP (Office 365 / smtp.office365.com) using the
    service account (SMTP_USER / SMTP_PASSWORD). Sends as SMTP_FROM_EMAIL.
    If `sender` is provided it is added as Reply-To so replies go to them.
    """
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_host     = os.environ.get("SMTP_HOST", "smtp.office365.com")
    smtp_port     = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user     = os.environ.get("SMTP_USER", "")
    smtp_password = os.environ.get("SMTP_PASSWORD", "")

    if not smtp_user or not smtp_password:
        raise RuntimeError("SMTP credentials not configured (SMTP_USER / SMTP_PASSWORD).")

    from_name  = os.environ.get("SMTP_FROM_NAME", "AURA Bot")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{from_name} <{from_email}>"
    msg["To"]      = to
    if sender and sender.strip():
        msg["Reply-To"] = sender.strip()
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to], msg.as_string())
    except smtplib.SMTPAuthenticationError as exc:
        raise RuntimeError(f"SMTP authentication failed: {exc}") from exc
    except smtplib.SMTPException as exc:
        raise RuntimeError(f"SMTP error: {exc}") from exc
    except OSError as exc:
        raise RuntimeError(f"Network error connecting to SMTP server: {exc}") from exc


def draft_email_from_chat(message: str) -> dict:
    """
    Uses the LLM to draft a professional email from a plain-language chat request.
    Returns {"to": str, "refined_subject": str, "refined_body": str}.
    Raises RuntimeError on failure.
    """
    user_content = f"Draft a professional email based on this employee request:\n\n\"{message.strip()}\""
    try:
        raw = _call_llm(user_content, system_prompt=_get_from_chat_system_prompt())
        return _parse_from_chat_response(raw)
    except Exception as exc:
        raise RuntimeError(f"LLM request failed: {exc}") from exc


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
        raw = _call_llm(user_content)
        return _parse_response(raw, subject)
    except Exception as exc:
        raise RuntimeError(f"LLM request failed: {exc}") from exc
