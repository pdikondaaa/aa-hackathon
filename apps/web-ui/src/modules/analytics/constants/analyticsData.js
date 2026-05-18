// ─── Analytics Static Mock Data ──────────────────────────────────────────────
// Replace each section with API calls via analyticsApi.js for live data.

export const OVERVIEW_STATS = [
  {
    id: 'totalUsers',
    label: 'Total Users',
    value: 248,
    icon: 'fa-users',
    color: '#1D76BC',
    delta: '+12%',
    positive: true,
    suffix: '',
  },
  {
    id: 'totalConversations',
    label: 'Total Conversations',
    value: 1842,
    icon: 'fa-comments',
    color: '#27AAE1',
    delta: '+8%',
    positive: true,
    suffix: '',
  },
  {
    id: 'totalQueries',
    label: 'Total Queries',
    value: 5640,
    icon: 'fa-magnifying-glass',
    color: '#4ED44E',
    delta: '+15%',
    positive: true,
    suffix: '',
  },
  {
    id: 'activeUsers',
    label: 'Active Users',
    value: 89,
    icon: 'fa-user-check',
    color: '#2A3D90',
    delta: '+5%',
    positive: true,
    suffix: '',
  },
  {
    id: 'avgResponseTime',
    label: 'Avg Response Time',
    value: '1.4',
    icon: 'fa-stopwatch',
    color: '#f59e0b',
    delta: '-0.2s faster',
    positive: true,
    suffix: 's',
  },
  {
    id: 'dailyUsage',
    label: "Today's Usage",
    value: 312,
    icon: 'fa-calendar-day',
    color: '#a855f7',
    delta: '+22%',
    positive: true,
    suffix: '',
  },
];

export const MOST_USED_TABS = [
  { tab: 'AI Assistant',    count: 3240, fill: '#1D76BC' },
  { tab: 'HR Assistant',    count: 1850, fill: '#27AAE1' },
  { tab: 'IT Support',      count: 1420, fill: '#4ED44E' },
  { tab: 'Document Hub',    count: 890,  fill: '#2A3D90' },
  { tab: 'Org Intelligence',count: 650,  fill: '#f59e0b' },
  { tab: 'Analytics',       count: 380,  fill: '#a855f7' },
];

export const DAILY_USAGE = [
  { date: 'May 1',  queries: 280, users: 65 },
  { date: 'May 2',  queries: 320, users: 72 },
  { date: 'May 3',  queries: 195, users: 48 },
  { date: 'May 4',  queries: 110, users: 30 },
  { date: 'May 5',  queries: 140, users: 35 },
  { date: 'May 6',  queries: 390, users: 88 },
  { date: 'May 7',  queries: 430, users: 95 },
  { date: 'May 8',  queries: 360, users: 82 },
  { date: 'May 9',  queries: 410, users: 91 },
  { date: 'May 10', queries: 480, users: 105 },
  { date: 'May 11', queries: 220, users: 52 },
  { date: 'May 12', queries: 160, users: 40 },
  { date: 'May 13', queries: 510, users: 112 },
  { date: 'May 14', queries: 470, users: 98 },
  { date: 'May 15', queries: 530, users: 118 },
  { date: 'May 16', queries: 498, users: 108 },
  { date: 'May 17', queries: 312, users: 89 },
];

export const QUERY_CATEGORIES = [
  { name: 'HR Queries',   value: 35, color: '#1D76BC' },
  { name: 'IT Support',   value: 28, color: '#27AAE1' },
  { name: 'Documents',    value: 18, color: '#4ED44E' },
  { name: 'Org Info',     value: 12, color: '#2A3D90' },
  { name: 'General',      value: 7,  color: '#f59e0b' },
];

export const ACTIVE_USERS_TREND = [
  { week: 'Week 1',  active: 62,  total: 180 },
  { week: 'Week 2',  active: 78,  total: 195 },
  { week: 'Week 3',  active: 85,  total: 210 },
  { week: 'Week 4',  active: 73,  total: 205 },
  { week: 'Week 5',  active: 91,  total: 220 },
  { week: 'Week 6',  active: 98,  total: 235 },
  { week: 'Week 7',  active: 88,  total: 240 },
  { week: 'Week 8',  active: 105, total: 248 },
];

export const PEAK_USAGE_HOURS = [
  { hour: '8AM',  count: 45 },
  { hour: '9AM',  count: 120 },
  { hour: '10AM', count: 185 },
  { hour: '11AM', count: 210 },
  { hour: '12PM', count: 165 },
  { hour: '1PM',  count: 98 },
  { hour: '2PM',  count: 175 },
  { hour: '3PM',  count: 220 },
  { hour: '4PM',  count: 190 },
  { hour: '5PM',  count: 130 },
  { hour: '6PM',  count: 65 },
  { hour: '7PM',  count: 30 },
];

export const TOP_QUERIES = [
  { id: 1, query: 'How many leaves do I have remaining?',     hits: 342, lastUsed: '2026-05-17', successRate: 98 },
  { id: 2, query: 'Explain the WFH policy',                   hits: 287, lastUsed: '2026-05-16', successRate: 95 },
  { id: 3, query: 'What is my current payroll status?',        hits: 254, lastUsed: '2026-05-17', successRate: 92 },
  { id: 4, query: 'How do I reset my VPN credentials?',        hits: 218, lastUsed: '2026-05-15', successRate: 89 },
  { id: 5, query: 'Generate an employment verification letter',hits: 196, lastUsed: '2026-05-17', successRate: 97 },
  { id: 6, query: 'What are my insurance benefits?',           hits: 184, lastUsed: '2026-05-16', successRate: 94 },
  { id: 7, query: 'Request NOC letter',                        hits: 162, lastUsed: '2026-05-14', successRate: 99 },
  { id: 8, query: 'IT ticket #1042 status',                    hits: 148, lastUsed: '2026-05-13', successRate: 87 },
  { id: 9, query: 'Explain the employee referral program',     hits: 136, lastUsed: '2026-05-12', successRate: 96 },
  { id: 10,query: 'How do I apply for maternity leave?',       hits: 121, lastUsed: '2026-05-11', successRate: 98 },
];

export const SUCCESS_VS_FAILED = [
  { date: 'May 11', success: 340, failed: 22 },
  { date: 'May 12', success: 195, failed: 15 },
  { date: 'May 13', success: 460, failed: 28 },
  { date: 'May 14', success: 420, failed: 19 },
  { date: 'May 15', success: 495, failed: 35 },
  { date: 'May 16', success: 455, failed: 43 },
  { date: 'May 17', success: 280, failed: 32 },
];

export const RECENT_ACTIVITIES = [
  { id: 1,  user: 'Amol M.',    action: 'Asked about WFH policy',              time: '2m ago',  category: 'HR',  type: 'query',    status: 'success' },
  { id: 2,  user: 'Priya S.',   action: 'Generated NOC letter',                time: '5m ago',  category: 'Doc', type: 'document', status: 'success' },
  { id: 3,  user: 'Rahul K.',   action: 'Raised IT ticket — VPN issue',        time: '12m ago', category: 'IT',  type: 'ticket',   status: 'pending' },
  { id: 4,  user: 'Sneha P.',   action: 'Checked leave balance',               time: '18m ago', category: 'HR',  type: 'query',    status: 'success' },
  { id: 5,  user: 'Vikram A.',  action: 'Requested salary certificate',        time: '25m ago', category: 'Doc', type: 'document', status: 'success' },
  { id: 6,  user: 'Deepa R.',   action: 'Queried insurance benefits',          time: '32m ago', category: 'HR',  type: 'query',    status: 'success' },
  { id: 7,  user: 'Nikhil B.',  action: 'Reset MFA — escalated to IT',        time: '45m ago', category: 'IT',  type: 'escalation',status: 'failed' },
  { id: 8,  user: 'Ananya T.',  action: 'Asked about Q2 all-hands agenda',    time: '1h ago',  category: 'Org', type: 'query',    status: 'success' },
  { id: 9,  user: 'Ravi M.',    action: 'Queried payroll discrepancy',         time: '1h ago',  category: 'HR',  type: 'escalation',status: 'pending' },
  { id: 10, user: 'Kavya N.',   action: 'Downloaded onboarding checklist',     time: '2h ago',  category: 'Doc', type: 'document', status: 'success' },
];

export const DATE_RANGE_OPTIONS = [
  { id: 'today',   label: 'Today' },
  { id: 'week',    label: 'This Week' },
  { id: 'month',   label: 'This Month' },
  { id: 'quarter', label: 'This Quarter' },
];
