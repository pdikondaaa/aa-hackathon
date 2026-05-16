// ─── AURA Chat Configuration ─────────────────────────────────────────────────
// Single source of truth. Edit here to retheme or rewire the entire UI.

export const chatConfig = {

  // ─── Theme — Aligned Automation brand palette ───────────────────────────────
  // Primary: Aligned Blue #1D76BC  │  Light Blue #27AAE1
  // Accent:  Energy Green #4ED44E  │  Deep Blue  #2A3D90
  // Backgrounds from Dark Blue #0F1C3F scale
  theme: {
    bg:            '#080d1a',
    bgSecondary:   '#0F1C3F',
    bgElevated:    '#122349',
    bgCard:        '#162d5c',
    border:        '#1d3568',
    borderLight:   '#132040',
    primary:       '#1D76BC',   // Aligned Blue
    primaryHover:  '#1a69a8',
    lightBlue:     '#27AAE1',   // Light Blue
    deepBlue:      '#2A3D90',   // Deep Blue
    secondary:     '#4ED44E',   // Energy Green (accent)
    text:          '#ffffff',
    textSecondary: '#a8bdd4',
    textMuted:     '#5e7a9a',
    success:       '#4ED44E',
    error:         '#f05252',
    warning:       '#f59e0b',
  },

  // ─── Light Theme ───────────────────────────────────────────────────────────
  lightTheme: {
    bg:            '#eef2f8',
    bgSecondary:   '#ffffff',
    bgElevated:    '#f4f7fc',
    bgCard:        '#e6edf6',
    border:        '#c8d6e8',
    borderLight:   '#dae4f0',
    primary:       '#1D76BC',
    primaryHover:  '#1a69a8',
    lightBlue:     '#27AAE1',
    deepBlue:      '#2A3D90',
    secondary:     '#27a827',
    text:          '#0d1b35',
    textSecondary: '#2d4a6e',
    textMuted:     '#6885a0',
    success:       '#27a827',
    error:         '#d93025',
    warning:       '#c97706',
  },

  // ─── Typography ────────────────────────────────────────────────────────────
  fonts: {
    family:     "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    baseSize:   '14px',
    lineHeight: '1.6',
  },

  // ─── App Meta ──────────────────────────────────────────────────────────────
  app: {
    name:        'AURA',
    subtitle:    'Aligned Unified Resource Assistant',
    version:     'v1.0',
  },

  // ─── External Links ────────────────────────────────────────────────────────
  links: {
    itHelpdesk: 'https://helpdesk.alignedautomation.com/',
  },

  // ─── Current User ──────────────────────────────────────────────────────────
  user: {
    name:       'Amol Metkari',
    initials:   'AM',
    department: 'TSS',
  },

  // ─── Sidebar Navigation (NovaMind-style features) ──────────────────────────
  navigation: [
    { id: 'aiAssistant', label: 'AI Assistant', icon: 'fa-robot',       active: true  },
    { id: 'documents',   label: 'Documents',    icon: 'fa-folder-open', active: false },
    { id: 'analytics',          label: 'Analytics',           icon: 'fa-chart-bar',     active: false },
  //{ id: 'onboardingGuidance', label: 'Onboarding Guidance', icon: 'fa-compass',       active: false },
   //{ id: 'myNotes',     label: 'My Notes',     icon: 'fa-sticky-note', active: false },
   // { id: 'emailAgent',  label: 'Email Agent',  icon: 'fa-envelope',    active: false },
  ],

  // ─── Sidebar Recent Chats ──────────────────────────────────────────────────
  recentChats: {
    today: [
      'How many leaves do I have left?',
      'Explain the WFH policy',
      'Request NOC letter',
    ],
    yesterday: [
      'IT ticket #1042 status',
      'Benefits eligibility check',
      'Payroll discrepancy — May',
    ],
  },

  // ─── Welcome Screen — Feature Cards ───────────────────────────────────────
  featureCards: [
    {
      id: 'hr',
      title:       'HR Assistant',
      description: 'Check leaves, payroll, benefits and policies instantly.',
      icon:        'fa-user-tie',
      color:       '#1D76BC',
      intro: "I'm the **HR Assistant** — here's what I can help you with:\n\n- 🏖️ **Leave management** — balances, applications, and policies (annual, casual, sick, maternity/paternity)\n- 💰 **Payroll & salary** — salary structure, payslips, increments, and appraisals\n- 🏥 **Benefits** — GHI insurance, PF/EPF, gratuity, Practo, IL TakeCare\n- 📋 **HR policies** — WFH, POSH, notice period, onboarding, and offboarding\n- 📝 **Referral & certifications** — employee referral program, skill certifications\n\nWhat would you like to know?",
    },
    {
      id: 'it',
      title:       'IT Support',
      description: 'Raise tickets, request access and get tech help fast.',
      icon:        'fa-laptop-code',
      color:       '#27AAE1',
      intro: "I'm the **IT Support** assistant — here's what I can help you with:\n\n- 🔐 **Access & passwords** — MFA setup, VPN, password resets, account access\n- 💻 **Devices & software** — laptop issues, software installation, hardware requests\n- 🌐 **Network & connectivity** — WiFi, remote access, OneDrive, Outlook, Teams\n- 🛡️ **Security** — antivirus, data backups, security incidents\n- 🖨️ **Office equipment** — printers, Polycom devices, peripherals\n\n🔗 **IT Help Desk Portal:** [helpdesk.alignedautomation.com](https://helpdesk.alignedautomation.com/)\n\nWhat IT issue can I help you resolve?",
    },
    {
      id: 'docs',
      title:       'Document Hub',
      description: 'Generate offer letters, NOC, payslips and certificates.',
      icon:        'fa-file-contract',
      color:       '#4ED44E',
      intro: "I'm the **Document Hub** — I can generate official HR documents for you:\n\n- 📄 **Employment letters** — experience letter, employment verification, confirmation letter\n- 📋 **Certificates** — bonafide certificate, internship certificate, salary certificate\n- 🏠 **Proof documents** — address proof, loan proof\n- 📃 **Official letters** — NOC (No Objection Certificate), promotion letter, relieving letter\n- 🪪 **ID & access** — ID card request\n\nWhich document would you like me to generate?",
    },
    {
      id: 'org',
      title:       'Org Intelligence',
      description: 'Explore org structure, directories and company updates.',
      icon:        'fa-sitemap',
      color:       '#2A3D90',
      intro: "I'm the **Org Intelligence** assistant — here's what I can help you explore:\n\n- 🏢 **Company info** — mission, vision, values, and culture\n- 👥 **Organization structure** — departments, leadership, and reporting hierarchy\n- 📇 **Employee directory** — find colleagues, contact details, and skill sets\n- 📊 **Company updates** — announcements, new policies, and initiatives\n\nWhat would you like to know about Aligned Automation?",
    },
  ],

  // ─── Welcome Suggestion Chips ──────────────────────────────────────────────
  suggestions: [
    'How many leaves do I have left?',
    'What is my current payroll status?',
    'Explain the leave encashment policy',
    'Show me onboarding checklist',
    'What benefits am I eligible for?',
  ],

  // ─── Right Panel — My Stats ────────────────────────────────────────────────
  stats: [
    { id: 'leaves',     label: 'Leaves Remaining', value: '14', unit: 'days',    delta: '+2',    positive: true,  color: '#27AAE1' },
    { id: 'tickets',    label: 'Open IT Tickets',  value: '2',  unit: 'tickets', delta: '-1',    positive: true,  color: '#4ED44E' },
    { id: 'attendance', label: 'Attendance',        value: '98', unit: '%',       delta: '+0.5%', positive: true,  color: '#2A3D90' },
  ],

  // ─── Right Panel — Recent Activity ─────────────────────────────────────────
  recentActivity: [
    { id: 1, text: 'Leave approved for May 12-14',  time: '2h ago',  color: '#27AAE1' },
    { id: 2, text: 'IT ticket #1042 resolved',       time: '4h ago',  color: '#4ED44E' },
    { id: 3, text: 'WFH Policy v2.1 published',      time: '1d ago',  color: '#1D76BC' },
    { id: 4, text: 'Q2 All-Hands on May 20',         time: '2d ago',  color: '#2A3D90' },
    { id: 5, text: 'NOC letter generated',           time: '3d ago',  color: '#4ED44E' },
  ],

  // ─── Right Panel — Escalations ─────────────────────────────────────────────
  escalations: [
    { id: 'ESC-001', title: 'Payroll discrepancy — May', domain: 'HR', status: 'In Progress', statusColor: '#f59e0b', domainColor: '#1D76BC' },
    { id: 'ESC-002', title: 'VPN access issue',           domain: 'IT', status: 'Open',        statusColor: '#f05252', domainColor: '#27AAE1' },
  ],

  // ─── Right Panel — Upcoming Events ─────────────────────────────────────────
  upcoming: [
    { id: 1, title: 'Q2 All-Hands Meeting',             date: '20 May 2026' },
    { id: 2, title: 'Company Holiday — Buddha Purnima', date: '12 May 2026' },
    { id: 3, title: 'Performance Review Window',         date: '1 May 2026' },
  ],

  // ─── Static Chat Messages (loaded on demand; empty = show welcome screen) ──
  messages: [],

  // ─── UI Labels ─────────────────────────────────────────────────────────────
  labels: {
    newChat:           'New Chat',
    features:          'FEATURES',
    today:             'TODAY',
    yesterday:         'YESTERDAY',
    overview:          'Overview',
    myStats:           'MY STATS',
    recentActivity:    'RECENT ACTIVITY',
    escalations:       'ESCALATIONS',
    upcoming:          'UPCOMING',
    kickstartHeading:  'Kickstart Your Journey with These Tools',
    learnMore:         'Learn more →',
    inputPlaceholder:  'Ask anything...',
    feedbackThanks:    'Thanks!',
    welcomeTitle:      'Welcome Back ✨',
    welcomeSubtitle:   'What Can I Help You With Today?',
    welcomeBodyText:   'Your AI assistant for HR, IT, Admin & Org queries. Ask me anything or pick a suggestion below.',
  },
};
