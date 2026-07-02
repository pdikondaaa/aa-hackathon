# AURA, Explained Without Jargon

**Organization:** Aligned Automation
**Document Date:** 2026-07-02
**Audience:** Anyone — no technical background required

---

## What is AURA?

AURA is Aligned Automation's internal AI assistant. Employees log in with their normal Microsoft work account and can type questions in plain English (or any language they type in) about HR policies, IT problems, company processes, their own attendance, and more — the same way they'd ask a knowledgeable coworker.

Instead of emailing HR, searching SharePoint, or waiting for IT, an employee opens AURA and gets an answer immediately, with the source document referenced so they can trust it.

Think of AURA as a smart receptionist that sits in front of several departments (HR, IT, Admin, Finance, PMO) and instantly forwards each question to whichever "department expert" knows the answer — except the expert is an AI model that has read the company's actual policy documents.

---

## What can it actually do today?

- **Answer policy questions** — leave, benefits, IT access, travel, parking — by reading the company's own SharePoint documents and quoting from them
- **Generate HR letters** — offer letters, experience letters, NOC certificates, and 9 other document types — through a short back-and-forth conversation
- **Look up your own attendance and profile** from the HR system (Zoho People)
- **Draft emails** and polish their tone before you send them
- **Create Microsoft Forms** (surveys, feedback forms) just by describing what you need
- **Raise and track escalations** when a question needs a real person
- **Request parking** at the Fountainhead office and track the request status
- **Show company announcements and events**, with RSVP
- **Show your project allocation** (for PMO/resourcing purposes)
- **Show company-wide skills data** (who knows what, by department)
- **Build simple internal forms and approval workflows** without needing a developer — this is one of the biggest and least-visible parts of the system
- **Guide new hires through an 8-step onboarding checklist**

## What does it look like it can do, but can't yet?

Being transparent about this matters, especially if you're using this platform in a demo or a leadership review:

- The **general usage-analytics dashboard** (charts about how many people used the chatbot, when, etc.) currently shows **sample/made-up numbers**, not real usage data.
- The **PMO project dashboard** (a separate screen from the real allocation board) shows **entirely fictional example projects** — it isn't connected to a live project database.
- The **in-app feedback/suggestion form** saves your submission only on your own computer's browser storage — it does **not** currently reach anyone at the company. (This is different from the thumbs-up/thumbs-down button on individual chat answers, which *does* get saved and is used for quality tracking.)

---

## How does it "know" company policies?

Company documents live in SharePoint — Word documents, PDFs, spreadsheets. A background job periodically:

1. Downloads every document from the relevant SharePoint sites
2. Splits each document into small overlapping chunks (roughly a paragraph or two each)
3. Converts each chunk into a mathematical "fingerprint" that captures its meaning
4. Stores those fingerprints in a database

When you ask AURA a question, it converts your question into the same kind of fingerprint and finds the stored chunks whose fingerprints are the closest match — in other words, it finds the paragraphs most likely to actually answer your question — and then asks the AI model to write an answer using only those paragraphs. This is why AURA can cite its sources: it isn't guessing, it's summarizing real retrieved text.

## Which AI model actually writes the answers?

This is configurable, not fixed. Depending on how the system is set up, it can use:

- **Anthropic's Claude** (a commercial cloud AI service), or
- **Groq** (a fast commercial cloud AI service), or
- **Ollama**, a model running on Aligned Automation's own server (`ml01`), which keeps everything in-house

The system checks its settings in that order and uses whichever is turned on. Earlier drafts of this documentation stated that AURA *only* uses a self-hosted, in-house model for privacy reasons — that is one available configuration, but the code today supports switching to a cloud AI provider as well. If data residency (keeping data from ever leaving the company network) is a hard requirement, that needs to be enforced by configuration and policy, not assumed from the code alone.

---

## How does it keep information safe?

- **Login is required** — you sign in with your normal Microsoft work account; there is no anonymous access.
- **A safety filter checks every message** before anything else happens — it blocks attempts to trick the AI into ignoring its rules, blocks requests for harmful content, and responds carefully (rather than just answering normally) if a message suggests someone is in distress or is asking about another employee's private information, salary, or similar sensitive topics.
- **Every meaningful action is logged** (an "audit trail") so that admin and platform teams can review what happened if there's ever a question about it.
- **Personal information (PII) is watched for** and logged when detected, so the company can track and improve how sensitive data is handled.

---

## Who is this documentation set for?

| If you are... | Start with... |
|---|---|
| A new employee or non-technical stakeholder | This document, then `10-reference/folder-structure.md` for a guided tour |
| A product manager or business stakeholder | `00-foundation/business-objectives.md` and `06-requirements/feature-catalog.md` |
| A new engineer joining the project | `10-reference/folder-structure.md`, then `10-reference/architecture-overview.md`, then `04-agents/agent-framework.md` |
| Someone auditing security or compliance | `01-governance/` and the Security section of `10-reference/architecture-overview.md` |

---

*This document intentionally avoids technical jargon. For precise, code-verified technical detail, see `10-reference/architecture-overview.md` and `10-reference/folder-structure.md`.*
