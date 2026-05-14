// ── Wizard step definitions ────────────────────────────────────────────────
export const WIZARD_STEPS = [
  { id: 'welcome',    step: 1, title: 'Welcome',             subtitle: 'Get started',              icon: 'fa-star',           status: 'completed' },
  { id: 'profile',    step: 2, title: 'Your Profile',        subtitle: 'Personal & bank details',  icon: 'fa-user',           status: 'completed' },
  { id: 'it-access',  step: 3, title: 'IT & Access',         subtitle: 'Tools & credentials',      icon: 'fa-shield-alt',     status: 'active'    },
  { id: 'policy',     step: 4, title: 'Policy & Compliance', subtitle: 'Review & sign',            icon: 'fa-file-contract',  status: 'pending'   },
  { id: 'induction',  step: 5, title: 'Induction',           subtitle: 'Videos & audio',           icon: 'fa-play-circle',    status: 'pending'   },
  { id: 'team',       step: 6, title: 'Team & Resources',    subtitle: 'Meet your team',           icon: 'fa-users',          status: 'pending'   },
  { id: 'documents',  step: 7, title: 'Documents',           subtitle: 'Upload & verify',          icon: 'fa-folder-open',    status: 'pending'   },
  { id: 'all-set',    step: 8, title: 'All Set',             subtitle: 'Wrap up',                  icon: 'fa-trophy',         status: 'pending'   },
];

// ── IT & Access tools ──────────────────────────────────────────────────────
export const IT_TOOLS = [
  {
    id: 'email',
    title: 'Email & Calendar',
    description: 'Microsoft 365 mailbox provisioned',
    detail: 'amol.metkari@alignedautomation.com',
    icon: 'fa-envelope',
    status: 'completed',
    action: null,
  },
  {
    id: 'vpn',
    title: 'VPN Access',
    description: 'Cisco AnyConnect profile ready to install',
    detail: 'Region: Asia-Pacific',
    icon: 'fa-lock',
    status: 'action-needed',
    action: 'Download config',
  },
  {
    id: 'sso',
    title: 'Single Sign-On',
    description: 'Okta workspace activated',
    detail: '12 apps connected',
    icon: 'fa-key',
    status: 'completed',
    action: null,
  },
  {
    id: 'device',
    title: 'Device Allocation',
    description: 'Laptop — shipping',
    detail: 'Arrives May 11',
    icon: 'fa-laptop',
    status: 'in-progress',
    action: null,
  },
  {
    id: 'security',
    title: 'Security & 2FA',
    description: 'Set up YubiKey + authenticator app',
    detail: 'Required before day one',
    icon: 'fa-shield-alt',
    status: 'action-needed',
    action: 'Set up now',
  },
  {
    id: 'slack',
    title: 'Slack',
    description: 'Team communication platform',
    detail: 'Channel: #engineering',
    icon: 'fa-comment-dots',
    status: 'completed',
    action: null,
  },
];

// ── Policy & Compliance documents ─────────────────────────────────────────
export const POLICIES = [
  {
    id: 'handbook',
    title: 'Employee Handbook',
    pages: 24,
    signed: false,
    version: 'v3.2',
    updated: 'April 2026',
    description: 'Mission, benefits, working norms. This document outlines the responsibilities, expectations, and protections that apply to every Aligned Automation team member.',
    sections: [
      { id: 's1', heading: 'Our Mission', body: 'Aligned Automation exists to help organisations work smarter through intelligent automation and AI. Every team member plays a critical role in delivering on this promise — we succeed as a team or not at all.' },
      { id: 's2', heading: 'Working Hours & Flexibility', body: 'Core collaboration hours are 10:00–16:00 in your local timezone. Outside those hours you are free to organise your work as suits your productivity, provided you meet your team commitments and client SLAs.' },
      { id: 's3', heading: 'Benefits', type: 'list', items: ['25 days paid annual leave + public holidays', 'Remote-first: work from any pre-approved country', 'Annual learning & development budget: ₹60,000 / £600', 'Private health insurance from day one', 'Quarterly wellness allowance'] },
      { id: 's4', heading: 'What You Must Do', type: 'dos', items: ['Complete all onboarding steps and mandatory training within your first 14 days', 'Notify your manager at least 48 hours before planned leave (2 weeks for more than 5 consecutive days)', 'Keep your emergency contacts and bank details current in the HRMS', 'Participate in quarterly performance conversations with your manager', 'Represent Aligned Automation professionally in all client and public interactions'] },
      { id: 's5', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not share internal compensation details with colleagues or externally', 'Do not work for a direct competitor without written consent from your manager', 'Do not take leave without prior approval — unapproved absences may be treated as unpaid leave', 'Do not conduct personal business activities during paid working hours'] },
    ],
  },
  {
    id: 'nda',
    title: 'Mutual NDA',
    pages: 6,
    signed: false,
    version: 'v2.1',
    updated: 'January 2026',
    description: 'This mutual non-disclosure agreement governs the confidential information shared between you and Aligned Automation during and after your employment.',
    sections: [
      { id: 's1', heading: 'Purpose', body: 'This agreement protects the legitimate business interests of both parties by setting clear boundaries around what information is confidential and how it must be handled during and after your employment.' },
      { id: 's2', heading: 'What Counts as Confidential', type: 'list', items: ['Client names, contacts, and commercial terms', 'Proprietary source code, algorithms, and system architecture', 'Financial data, pricing models, and business forecasts', 'Internal strategy, roadmaps, and M&A discussions', 'Any information marked CONFIDENTIAL or provided in a confidential context'] },
      { id: 's3', heading: 'What You Must Do', type: 'dos', items: ['Treat all client and project information as confidential by default', 'Store sensitive documents only in approved platforms (SharePoint, AURA vault)', 'Notify the Legal team immediately if confidential information has been disclosed without authorisation', 'Dispose of confidential material securely — shred paper, wipe devices per the IT policy'] },
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not share client names, project details, or financials with anyone outside the company', 'Do not discuss confidential matters in public spaces, on personal devices, or over unencrypted channels', 'Do not retain copies of confidential documents after your employment ends', 'Do not use confidential information for personal gain or to benefit a third party'] },
      { id: 's5', heading: 'Duration', body: 'Confidentiality obligations survive termination of employment for three (3) years for general business information and indefinitely for trade secrets.' },
    ],
  },
  {
    id: 'sec-policy',
    title: 'Information Security Policy',
    pages: 12,
    signed: false,
    version: 'v4.0',
    updated: 'March 2026',
    description: 'Guidelines for protecting company data, systems, and intellectual property. Compliance is mandatory for all team members.',
    sections: [
      { id: 's1', heading: 'Purpose', body: 'Information is one of Aligned Automation\'s most critical assets. This policy sets the minimum controls required to prevent unauthorised access, data loss, and security incidents across all systems.' },
      { id: 's2', heading: 'Passwords & Access Management', type: 'dos', items: ['Use a unique, complex password (14+ characters) for each company system', 'Enable multi-factor authentication (MFA) on all accounts — this is mandatory', 'Use the company-approved password manager (1Password) to store all credentials', 'Request access via the IT Help Desk; never share credentials with colleagues'] },
      { id: 's3', heading: 'Device & Network Security', type: 'dos', items: ['Enable full-disk encryption (BitLocker / FileVault) on all devices used for work', 'Lock your screen when stepping away — Win+L on Windows, Cmd+Ctrl+Q on Mac', 'Connect to the corporate VPN when accessing internal systems from outside the office', 'Install all OS and application security patches within 72 hours of release'] },
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not install unlicensed or unapproved software on company devices', 'Do not transfer company data to personal cloud storage (Google Drive, Dropbox, iCloud)', 'Do not connect company devices to public Wi-Fi without VPN active', 'Do not open email attachments or click links from unknown senders', 'Do not disable security software (antivirus or EDR agents) for any reason', 'Do not store passwords in plain-text files, spreadsheets, or chat messages'] },
      { id: 's5', heading: 'Incident Reporting', body: 'Any suspected security incident — including lost/stolen devices, phishing emails, or unauthorised access — must be reported to security@alignedautomation.com or via the IT Help Desk within 1 hour of discovery. Prompt reporting limits damage and is required by our cyber insurance policy.' },
    ],
  },
  {
    id: 'conduct',
    title: 'Code of Conduct',
    pages: 9,
    signed: false,
    version: 'v2.5',
    updated: 'February 2026',
    description: 'Standards for professional behavior, workplace ethics, and our commitment to an inclusive and respectful environment.',
    sections: [
      { id: 's1', heading: 'Our Values', body: 'Aligned Automation is built on four values: Integrity, Curiosity, Collaboration, and Impact. This Code of Conduct translates those values into day-to-day behaviours we expect of every team member, regardless of seniority or location.' },
      { id: 's2', heading: 'Inclusive Workplace', body: 'We are committed to a workplace free from discrimination and harassment. Every individual deserves to be treated with dignity and respect, irrespective of age, gender, race, religion, disability, sexual orientation, or background.' },
      { id: 's3', heading: 'What You Must Do', type: 'dos', items: ['Speak up if you witness or experience harassment, bullying, or unethical behaviour — use the anonymous ethics hotline if needed', 'Declare any conflict of interest to your manager in writing before taking action', 'Treat colleagues, clients, and partners with courtesy and professionalism at all times', 'Give credit to colleagues for their contributions in public forums', 'Complete the annual Code of Conduct refresher training'] },
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not engage in any form of harassment, bullying, or discrimination', 'Do not make derogatory comments about colleagues, clients, or competitors — in person or online', 'Do not accept gifts valued above ₹2,000 / £20 without declaring them to Finance', 'Do not misrepresent your credentials, deliverables, or working hours', 'Do not retaliate against anyone who raises a concern in good faith'] },
      { id: 's5', heading: 'Reporting & Enforcement', body: 'Violations should be reported to your HR Business Partner or via the anonymous Ethics Hotline (ethics@alignedautomation.com). All reports are investigated promptly. Substantiated violations may result in disciplinary action up to and including termination.' },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use Policy',
    pages: 5,
    signed: false,
    version: 'v1.3',
    updated: 'April 2026',
    description: 'Defines permitted and prohibited use of the AURA onboarding platform and all internal digital tools.',
    sections: [
      { id: 's1', heading: 'Purpose', body: 'This policy ensures that Aligned Automation\'s digital tools — including AURA, Slack, Jira, GitHub, and Microsoft 365 — are used securely, productively, and in a way that protects the company and its clients.' },
      { id: 's2', heading: 'Permitted Uses', type: 'list', items: ['Onboarding and training activities via AURA', 'Client project work using approved collaboration tools', 'Internal communications via approved messaging platforms (Slack, Teams)', 'Software development using company-approved repositories (GitHub)', 'Reasonable personal use that does not interfere with work duties'] },
      { id: 's3', heading: 'What You Must Do', type: 'dos', items: ['Use company-issued accounts for all professional communications', 'Log out of all systems at the end of each working session', 'Report suspicious activity, spam, or phishing attempts to the IT Help Desk immediately', 'Follow data classification labels when sharing files — INTERNAL, CONFIDENTIAL, RESTRICTED'] },
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not use company accounts for personal business, political campaigns, or external fundraising', 'Do not install browser extensions or plugins not on the approved software list', 'Do not use company platforms to distribute offensive, illegal, or copyrighted content', 'Do not share your AURA or any company login credentials with anyone, including colleagues', 'Do not use company infrastructure for cryptocurrency mining or unrelated computation', 'Do not attempt to access systems or data beyond your authorised scope'] },
      { id: 's5', heading: 'Monitoring', body: 'System usage may be monitored by IT and Security teams for compliance, audit, and security purposes. By using company systems, you consent to this monitoring in accordance with applicable privacy laws.' },
    ],
  },
  {
    id: 'data-privacy',
    title: 'Data Privacy & Retention Policy',
    pages: 8,
    signed: false,
    version: 'v2.0',
    updated: 'March 2026',
    description: 'Explains how personal data is collected, stored, used, and deleted in compliance with applicable data protection regulations.',
    sections: [
      { id: 's1', heading: 'Purpose', body: 'Aligned Automation collects and processes personal data in the course of its operations. This policy sets out how that data is handled to comply with GDPR, India\'s DPDPA 2023, and other applicable regulations.' },
      { id: 's2', heading: 'Data We Collect', type: 'list', items: ['Identity & contact data (name, email, phone, address)', 'Employment data (role, department, payroll details)', 'Usage data from internal platforms (AURA, Slack, Jira activity logs)', 'Client data processed on behalf of customers under Data Processing Agreements'] },
      { id: 's3', heading: 'What You Must Do', type: 'dos', items: ['Only collect personal data that is necessary for a defined, legitimate purpose', 'Store personal data only in approved, secured systems', 'Forward data subject access requests to privacy@alignedautomation.com within 48 hours of receipt', 'Complete the annual data privacy training module', 'Pseudonymise or anonymise data wherever feasible before sharing internally'] },
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: ['Do not store personal data on personal devices or unsanctioned cloud services', 'Do not transfer personal data outside approved jurisdictions without legal review', 'Do not retain personal data beyond its stated retention period', 'Do not share personal data with third parties without a signed Data Processing Agreement', 'Do not use production datasets containing personal data for testing or development'] },
      { id: 's5', heading: 'Retention Schedule', body: 'Employee records: 7 years post-employment. Client project data: 5 years post-project completion. System logs: 12 months. Marketing data: until consent is withdrawn. Data due for deletion is reviewed quarterly by the DPO.' },
    ],
  },
  {
    id: 'ai-usage',
    title: 'AI Tool Usage Policy',
    pages: 4,
    signed: false,
    version: 'v1.0',
    updated: 'May 2026',
    description: 'Governs the use of AI-powered features within AURA, including the onboarding assistant, intelligent document search, and RAG-powered Q&A.',
    sections: [
      { id: 's1', heading: 'Purpose & Scope', body: 'AURA (AI Unified Resource Assistant) is Aligned Automation\'s AI-powered onboarding and knowledge platform. This policy governs how all employees, contractors, and consultants may use AURA\'s AI features — including the onboarding assistant, intelligent document search, RAG-powered Q&A, and any future AI capabilities — to ensure responsible, secure, and compliant usage across the organisation.' },
      { id: 's2', heading: 'How AURA\'s AI Works', body: 'AURA uses Retrieval-Augmented Generation (RAG) to answer questions by searching verified internal documents and policies before generating a response. While this significantly improves accuracy, AI responses are guidance — not authoritative decisions. Always verify critical actions against the cited source document, your manager, HR, or the relevant system of record.' },
      { id: 's3', heading: 'What You Must Do', type: 'dos', items: [
        'Use AURA for legitimate work activities: onboarding guidance, policy clarification, IT queries, and knowledge retrieval from approved internal documents',
        'Verify AI-generated responses against the cited source documents before acting on them for compliance, legal, or financial matters',
        'Report inaccurate, harmful, or unexpected AI responses immediately to the IT Help Desk (help@alignedautomation.com)',
        'Use the thumbs-up / thumbs-down feedback on AI responses — your ratings directly improve AURA\'s accuracy',
        'Keep your AURA credentials private and log out after each session, especially on shared or public devices',
        'Follow data classification rules when uploading documents — only upload materials you are authorised to share',
        'Escalate to your manager or HR if AURA\'s guidance conflicts with direct instructions from your team',
      ]},
      { id: 's4', heading: 'What You Must NOT Do', type: 'donts', items: [
        'Do NOT input confidential client information, personally identifiable data (PII), financial account details, or trade secrets into AURA prompts',
        'Do NOT attempt to jailbreak, manipulate, or inject adversarial prompts to bypass AURA\'s safety filters or access data outside your authorised scope',
        'Do NOT share AI-generated AURA outputs externally — with clients, partners, or media — without review and written approval from your manager',
        'Do NOT rely on AURA as the sole basis for legal, medical, payroll, or compliance-critical decisions; always escalate to the relevant authority',
        'Do NOT use AURA to generate content that is discriminatory, offensive, or in violation of the Code of Conduct',
        'Do NOT attempt to access other users\' AURA sessions, query histories, or personal data',
        'Do NOT upload third-party proprietary documents, licensed content, or materials marked RESTRICTED unless explicitly authorised',
        'Do NOT use AURA outputs to misrepresent Aligned Automation\'s positions, policies, or products to any internal or external stakeholder',
      ]},
      { id: 's5', heading: 'Data Handling & Audit', body: 'All queries submitted to AURA are logged, encrypted at rest and in transit, and retained for 12 months for security, quality, and audit purposes. Logs are accessible only to authorised Security and Compliance administrators. AURA does not use your queries to train the underlying language model. Refer to the Data Privacy & Retention Policy for further details.' },
      { id: 's6', heading: 'Consequences of Misuse', body: 'Violations of this policy — including attempts to extract unauthorised data, submitting confidential client information, or sharing AI outputs without approval — may result in immediate suspension of AURA access, disciplinary action in line with the Code of Conduct, or referral to Legal for further action depending on severity and intent.' },
    ],
  },
];

// ── Induction modules ──────────────────────────────────────────────────────
export const INDUCTION_MODULES = [
  { id: 1, title: 'Our Story & Mission',           duration: '6 min',  status: 'in-progress' },
  { id: 2, title: 'How We Work — Agile & Async',   duration: '8 min',  status: 'up-next'     },
  { id: 3, title: 'Diversity, Equity & Inclusion', duration: '5 min',  status: 'up-next'     },
  { id: 4, title: 'Code of Conduct & Ethics',      duration: '4 min',  status: 'up-next'     },
];

// ── Team members ───────────────────────────────────────────────────────────
export const TEAM_MEMBERS = [
  { id: 1, name: 'Rajesh Kumar',   role: 'Engineering Manager',   initials: 'RK', color: '#1D76BC', badge: 'MANAGER' },
  { id: 2, name: 'Sarah Mitchell', role: 'Senior Engineer · Mentor', initials: 'SM', color: '#27AAE1', badge: 'BUDDY'   },
  { id: 3, name: 'Priya Sharma',   role: 'Senior Designer',       initials: 'PS', color: '#4ED44E', badge: 'POD'     },
  { id: 4, name: 'Marcus Lee',     role: 'Product Manager',       initials: 'ML', color: '#2A3D90', badge: 'POD'     },
  { id: 5, name: 'Kiran Sethi',    role: 'QA Lead',               initials: 'KS', color: '#f59e0b', badge: 'POD'     },
];

// ── Tools & software ───────────────────────────────────────────────────────
export const TOOLS = [
  { id: 'slack',  name: 'Slack',  desc: 'Team chat',      initial: 'S', color: '#4A154B' },
  { id: 'jira',   name: 'Jira',   desc: 'Tickets & sprints', initial: 'J', color: '#0052CC' },
  { id: 'github', name: 'GitHub', desc: 'Source control', initial: 'G', color: '#333'    },
  { id: 'figma',  name: 'Figma',  desc: 'Design system',  initial: 'F', color: '#F24E1E' },
  { id: 'notion', name: 'Notion', desc: 'Docs & wiki',    initial: 'N', color: '#000'    },
  { id: 'linear', name: 'Linear', desc: 'Roadmap',        initial: 'L', color: '#5E6AD2' },
];

// ── Quick resources ────────────────────────────────────────────────────────
export const QUICK_RESOURCES = [
  'Engineering Handbook',
  'Architecture Overview',
  'Brand & Design System',
  'IT Support Portal',
];

// ── Required documents ─────────────────────────────────────────────────────
export const REQUIRED_DOCUMENTS = [
  { id: 'id-proof',    label: 'Government ID Proof',    required: true,  uploaded: true,  fileName: 'passport.pdf'      },
  { id: 'addr-proof',  label: 'Address Proof',          required: true,  uploaded: true,  fileName: 'utility_bill.pdf'  },
  { id: 'edu-cert',    label: 'Education Certificate',  required: true,  uploaded: false, fileName: null                },
  { id: 'exp-cert',    label: 'Experience Certificate', required: true,  uploaded: false, fileName: null                },
  { id: 'bank-form',   label: 'Bank Account Form',      required: true,  uploaded: true,  fileName: 'bank_form.pdf'     },
  { id: 'photo',       label: 'Passport Photo',         required: false, uploaded: true,  fileName: 'photo.jpg'         },
];
