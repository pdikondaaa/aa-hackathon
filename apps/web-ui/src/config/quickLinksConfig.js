// ─── Quick Links Configuration ────────────────────────────────────────────────
// iconImg: URL for the brand image (uses Google favicon service or brand CDN).
//          Omit to use the Font Awesome `icon` instead.
// icon   : Font Awesome 5 free solid class — shown when iconImg is absent/fails.
// color  : hex accent for icon tile background and hover glow.

export const QUICK_LINKS = [
  {
    id: 'aa-website',
    label: 'Aligned Automation',
    url: 'https://alignedautomation.com/',
    // Local logo injected by TopBar — no iconImg needed here
    icon: 'fa-building',
    iconImg: 'https://www.zohowebstatic.com/sites/zweb/images/productlogos/people.svg',
    color: '#1D76BC',
  },
  {
    id: 'ai-xchange',
    label: 'AI XChange',
    url: 'https://aixchangehub.azurewebsites.net/',
    // Azure subdomain returns a generic icon — use FA robot
    icon: 'fa-robot',
    color: '#7C3AED',
  },
  {
    id: 'employee-dir',
    label: 'Employee Directory',
    url: 'https://alignedautomation.sharepoint.com/sites/Nexus/EmpDir',
    icon: 'fa-address-book',
    color: '#0078D4',
  },
  {
    id: 'zoho-people',
    label: 'Zoho People',
    url: 'https://people.zoho.com/alignedautomationservices/zp',
    icon: 'fa-users',
    // Zoho People product CDN — colorful hexagon logo; falls back to fa-users
    iconImg: 'https://www.zohowebstatic.com/sites/zweb/images/productlogos/people.svg',
    color: '#E8562A',
  },
  {
    id: 'helpdesk',
    label: 'Helpdesk',
    url: 'https://helpdesk.alignedautomation.com/',
    // Custom subdomain — use a prominent FA icon
    icon: 'fa-headset',
    color: '#DC2626',
  },
  {
    id: 'hr-policies',
    label: 'HR Policies',
    url: 'https://alignedautomation.sharepoint.com/sites/Nexus/DigitalKnowledgeManagement/HR/Shared%20Documents/Forms/AllItems.aspx?id=/sites/Nexus/DigitalKnowledgeManagement/HR/Shared%20Documents/HR%20Policies&p=true&ga=1',
    icon: 'fa-file-contract',
    color: '#0891B2',
  },
  {
    id: 'laqsh-payroll',
    label: 'LAQSH Payroll',
    url: 'https://laqsh.co.in/panel/dashboard',
    icon: 'fa-money-bill-wave',
    iconImg: 'https://www.google.com/s2/favicons?domain=laqsh.co.in&sz=64',
    color: '#16A34A',
  },
  {
    id: 'zoho-expense',
    label: 'Zoho Expense',
    url: 'https://expense.zoho.com/app/785056548#/home/dashboard',
    // fa-receipt in Zoho Expense red exactly matches their red receipt brand icon
    icon: 'fa-receipt',
    color: '#E8562A',
  },
  {
    id: 'allyvate',
    label: 'Allyvate Community',
    url: 'https://web.yammer.com/main/org/alignedautomation.com/groups/eyJfdHlwZSI6Ikdyb3VwIiwiaWQiOiIxNzI3Mjk5OTExNjgifQ/new',
    icon: 'fa-comments',
    iconImg: 'https://www.google.com/s2/favicons?domain=yammer.com&sz=64',
    color: '#9333EA',
  },
  {
    id: 'proposal-support',
    label: 'Proposal Support',
    url: 'https://forms.office.com/pages/responsepage.aspx?id=tTXNPcX5ykiGU4IVaK0zlwNwtp8_xERGr-uWoR3SS2xUOE8wSEhaRTU4Q1VTUEpHOTBPMVVJMTVSNi4u&route=shorturl',
    icon: 'fa-clipboard-list',
    iconImg: 'https://www.google.com/s2/favicons?domain=forms.office.com&sz=64',
    color: '#0F766E',
  },
];
