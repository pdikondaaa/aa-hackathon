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
  },
  {
    id: 'nda',
    title: 'Mutual NDA',
    pages: 6,
    signed: false,
    version: 'v2.1',
    updated: 'January 2026',
    description: 'This mutual non-disclosure agreement governs the confidential information shared between you and Aligned Automation during and after your employment.',
  },
  {
    id: 'sec-policy',
    title: 'Information Security Policy',
    pages: 12,
    signed: false,
    version: 'v4.0',
    updated: 'March 2026',
    description: 'Guidelines for protecting company data, systems, and intellectual property. Compliance is mandatory for all team members.',
  },
  {
    id: 'conduct',
    title: 'Code of Conduct',
    pages: 9,
    signed: false,
    version: 'v2.5',
    updated: 'February 2026',
    description: 'Standards for professional behavior, workplace ethics, and our commitment to an inclusive and respectful environment.',
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
