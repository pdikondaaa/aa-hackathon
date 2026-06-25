import React, { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';

// ── Palette ───────────────────────────────────────────────────────────────────
const STATUS_META = {
  'On Track':   { color: '#16A34A', icon: 'fa-circle-check' },
  'At Risk':    { color: '#D97706', icon: 'fa-triangle-exclamation' },
  'Off Track':  { color: '#DC2626', icon: 'fa-circle-xmark' },
  'Completed':  { color: '#0891B2', icon: 'fa-flag-checkered' },
  'On Hold':    { color: '#7C3AED', icon: 'fa-pause-circle' },
  'Planning':   { color: '#5e7a9a', icon: 'fa-compass-drafting' },
};

const PRIORITY_META = {
  'Critical': { color: '#DC2626' },
  'High':     { color: '#D97706' },
  'Medium':   { color: '#1D76BC' },
  'Low':      { color: '#16A34A' },
};

// ── Mock project data ─────────────────────────────────────────────────────────
const PROJECTS = [
  { id: 'P001', name: 'NextGen ERP Migration',      status: 'At Risk',   priority: 'Critical', owner: 'Amol Metkari',     due: '2026-07-31', progress: 52, budget: 95, team: 8 },
  { id: 'P002', name: 'AI Onboarding Portal',        status: 'On Track',  priority: 'High',     owner: 'Ayushi Singh',     due: '2026-08-15', progress: 74, budget: 68, team: 5 },
  { id: 'P003', name: 'CRM Integration Phase 2',     status: 'On Track',  priority: 'High',     owner: 'Maithili Joshi',   due: '2026-09-01', progress: 41, budget: 44, team: 6 },
  { id: 'P004', name: 'Infrastructure Modernisation',status: 'Off Track', priority: 'Critical', owner: 'Prashant Dikonda', due: '2026-06-30', progress: 28, budget: 112, team: 10 },
  { id: 'P005', name: 'Customer Analytics Dashboard', status: 'Completed', priority: 'Medium',  owner: 'Namita Bandal',    due: '2026-05-31', progress: 100, budget: 88, team: 4 },
  { id: 'P006', name: 'Compliance & Audit 2026',     status: 'On Track',  priority: 'High',     owner: 'Yogeshbrijlal C.', due: '2026-10-15', progress: 33, budget: 55, team: 3 },
  { id: 'P007', name: 'Mobile App v2.0',             status: 'Planning',  priority: 'Medium',   owner: 'Amol Metkari',     due: '2026-11-30', progress: 8, budget: 30, team: 5 },
  { id: 'P008', name: 'Data Warehouse Refresh',      status: 'On Hold',   priority: 'Low',      owner: 'Ayushi Singh',     due: '2026-12-15', progress: 15, budget: 40, team: 3 },
];

const MILESTONES = [
  { project: 'NextGen ERP Migration',       milestone: 'UAT Sign-off',           due: '2026-06-25', status: 'Overdue'  },
  { project: 'Infrastructure Modernisation',milestone: 'Prod Deployment',         due: '2026-06-30', status: 'Overdue'  },
  { project: 'AI Onboarding Portal',        milestone: 'Beta Launch',             due: '2026-07-10', status: 'Upcoming' },
  { project: 'CRM Integration Phase 2',     milestone: 'Data Migration Complete', due: '2026-07-20', status: 'Upcoming' },
  { project: 'Compliance & Audit 2026',     milestone: 'Risk Assessment Review',  due: '2026-07-31', status: 'Upcoming' },
];

const RISKS = [
  { id: 'R001', project: 'NextGen ERP',             description: 'Vendor delivery slipping — integration APIs not finalised', impact: 'Critical', likelihood: 'High',   owner: 'Amol Metkari',  status: 'Open'     },
  { id: 'R002', project: 'Infrastructure Modernisation', description: 'Resource constraint: 2 engineers on leave next sprint',  impact: 'High',     likelihood: 'High',   owner: 'Prashant D.', status: 'Open'     },
  { id: 'R003', project: 'Mobile App v2.0',         description: 'Scope creep from stakeholder change requests',              impact: 'Medium',    likelihood: 'Medium', owner: 'Amol Metkari',  status: 'Mitigated'},
  { id: 'R004', project: 'CRM Integration Ph.2',    description: 'Legacy data quality issues discovered in source system',    impact: 'High',     likelihood: 'Medium', owner: 'Maithili J.',   status: 'Open'     },
];

const MONTHLY_DELIVERABLES = [
  { month: 'Jan', planned: 8,  delivered: 7  },
  { month: 'Feb', planned: 10, delivered: 9  },
  { month: 'Mar', planned: 12, delivered: 11 },
  { month: 'Apr', planned: 9,  delivered: 10 },
  { month: 'May', planned: 11, delivered: 8  },
  { month: 'Jun', planned: 7,  delivered: 4  },
];

// ── Small components ──────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="pmo-stat-card">
      <div className="pmo-stat-icon" style={{ background: `${color}1a`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div>
        <div className="pmo-stat-value">{value}</div>
        <div className="pmo-stat-label">{label}</div>
        {sub && <div className="pmo-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color: '#6b7280', icon: 'fa-circle' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 20,
      background: `${m.color}18`, border: `1px solid ${m.color}44`,
      color: m.color, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <i className={`fas ${m.icon}`} style={{ fontSize: 9 }} />
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || { color: '#6b7280' };
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      background: `${m.color}18`, color: m.color,
      fontSize: 11, fontWeight: 600,
    }}>{priority}</span>
  );
}

function ProgressBar({ value, color = '#1D76BC' }) {
  const c = value === 100 ? '#16A34A' : value < 30 ? '#DC2626' : color;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: c, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, display: 'inline-block' }} />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PieChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text)',
    }}>
      <strong>{payload[0].name}</strong>: {payload[0].value} project{payload[0].value !== 1 ? 's' : ''}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function PMODashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQ, setSearchQ] = useState('');

  const statusCounts = useMemo(() => {
    const acc = {};
    PROJECTS.forEach(p => { acc[p.status] = (acc[p.status] || 0) + 1; });
    return acc;
  }, []);

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name, value, color: STATUS_META[name]?.color || '#6b7280',
  }));

  const totalBudgetSpend = useMemo(() =>
    Math.round(PROJECTS.reduce((s, p) => s + p.budget, 0) / PROJECTS.length), []);

  const atRisk  = PROJECTS.filter(p => p.status === 'At Risk' || p.status === 'Off Track').length;
  const dueSoon = MILESTONES.filter(m => m.status === 'Upcoming').length;
  const completed = PROJECTS.filter(p => p.status === 'Completed').length;

  const filteredProjects = useMemo(() => PROJECTS.filter(p => {
    const matchStatus = statusFilter === 'All' || p.status === statusFilter;
    const matchSearch = !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase()) || p.owner.toLowerCase().includes(searchQ.toLowerCase());
    return matchStatus && matchSearch;
  }), [statusFilter, searchQ]);

  const TABS = ['overview', 'projects', 'milestones', 'risks'];
  const TAB_LABELS = { overview: 'Overview', projects: 'Projects', milestones: 'Milestones', risks: 'Risk Register' };
  const TAB_ICONS  = { overview: 'fa-gauge-high', projects: 'fa-list-check', milestones: 'fa-flag', risks: 'fa-triangle-exclamation' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-diagram-project" style={{ color: '#0F766E' }} />
          Project Hub
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0', fontSize: 14 }}>
          PMO command centre — track projects, milestones, and risks across the organisation.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px', border: 'none', borderRadius: '8px 8px 0 0',
              background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13, cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #0F766E' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7,
              whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            <i className={`fas ${TAB_ICONS[tab]}`} style={{ fontSize: 12 }} />
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ──────────────── OVERVIEW ──────────────── */}
      {activeTab === 'overview' && (
        <>
          {/* Stat cards */}
          <div className="pmo-stats-row" style={{ marginBottom: 24 }}>
            <StatCard icon="fa-folder-open"          label="Active Projects"      value={PROJECTS.filter(p => p.status !== 'Completed').length} color="#1D76BC" />
            <StatCard icon="fa-triangle-exclamation" label="Needs Attention"       value={atRisk}    sub="at risk or off track" color="#DC2626"  />
            <StatCard icon="fa-flag"                 label="Milestones Due Soon"   value={dueSoon}   sub="next 30 days"         color="#D97706"  />
            <StatCard icon="fa-circle-check"         label="Completed (Q2)"        value={completed} color="#16A34A" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 24 }}>

            {/* Status pie */}
            <div className="pmo-card">
              <div className="pmo-card-title">
                <i className="fas fa-chart-pie" style={{ color: '#0F766E' }} />
                Project Status Distribution
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<PieChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 4 }}>
                {pieData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly deliverables bar */}
            <div className="pmo-card">
              <div className="pmo-card-title">
                <i className="fas fa-chart-bar" style={{ color: '#0F766E' }} />
                Monthly Deliverables — Planned vs Delivered
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={MONTHLY_DELIVERABLES} barGap={4} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--border)', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="planned"   name="Planned"   fill="#1D76BC" radius={[4,4,0,0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#0F766E" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary project health table */}
          <div className="pmo-card">
            <div className="pmo-card-title">
              <i className="fas fa-heartbeat" style={{ color: '#0F766E' }} />
              Portfolio Health Snapshot
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Project', 'Status', 'Owner', 'Progress', 'Budget Utilised'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROJECTS.slice(0, 6).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{p.name}</td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.owner}</td>
                    <td style={{ padding: '10px 12px', minWidth: 130 }}><ProgressBar value={p.progress} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 12, color: p.budget > 100 ? '#DC2626' : 'var(--text-secondary)', fontWeight: p.budget > 100 ? 700 : 400 }}>
                        {p.budget}%{p.budget > 100 && <i className="fas fa-arrow-up" style={{ marginLeft: 4, fontSize: 10 }} />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ──────────────── PROJECTS ──────────────── */}
      {activeTab === 'projects' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12 }} />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search projects or owners…"
                style={{ width: '100%', padding: '8px 12px 8px 30px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['All', ...Object.keys(STATUS_META)].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)} style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${statusFilter === s ? (STATUS_META[s]?.color || 'var(--primary)') : 'var(--border)'}`,
                  background: statusFilter === s ? `${STATUS_META[s]?.color || '#1D76BC'}18` : 'transparent',
                  color: statusFilter === s ? (STATUS_META[s]?.color || 'var(--primary)') : 'var(--text-muted)',
                  fontWeight: statusFilter === s ? 600 : 400,
                }}>
                  {s === 'All' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          <div className="pmo-card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Project Name', 'Status', 'Priority', 'Owner', 'Due Date', 'Progress', 'Team'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < filteredProjects.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.id}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)', fontWeight: 500, maxWidth: 220 }}>{p.name}</td>
                    <td style={{ padding: '11px 14px' }}><StatusBadge status={p.status} /></td>
                    <td style={{ padding: '11px 14px' }}><PriorityBadge priority={p.priority} /></td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{p.owner}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(p.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '11px 14px', minWidth: 120 }}><ProgressBar value={p.progress} /></td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <i className="fas fa-users" style={{ fontSize: 10 }} /> {p.team}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredProjects.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No projects match the current filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ──────────────── MILESTONES ──────────────── */}
      {activeTab === 'milestones' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <StatCard icon="fa-circle-exclamation" label="Overdue Milestones"  value={MILESTONES.filter(m => m.status === 'Overdue').length}  color="#DC2626" />
            <StatCard icon="fa-calendar-days"      label="Upcoming (30 days)" value={MILESTONES.filter(m => m.status === 'Upcoming').length} color="#D97706" />
          </div>
          <div className="pmo-card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Project', 'Milestone', 'Due Date', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MILESTONES.map((m, i) => {
                  const overdue = m.status === 'Overdue';
                  return (
                    <tr key={i} style={{ borderBottom: i < MILESTONES.length - 1 ? '1px solid var(--border-light)' : 'none', background: overdue ? 'rgba(220,38,38,0.03)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{m.project}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>{m.milestone}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: overdue ? '#DC2626' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                        {new Date(m.due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: overdue ? 'rgba(220,38,38,0.12)' : 'rgba(217,119,6,0.12)',
                          color: overdue ? '#DC2626' : '#D97706',
                          border: `1px solid ${overdue ? '#DC262644' : '#D9770644'}`,
                        }}>
                          <i className={`fas ${overdue ? 'fa-clock' : 'fa-calendar'}`} style={{ marginRight: 5, fontSize: 9 }} />
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ──────────────── RISK REGISTER ──────────────── */}
      {activeTab === 'risks' && (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <StatCard icon="fa-fire"            label="Open Risks"      value={RISKS.filter(r => r.status === 'Open').length}      color="#DC2626" />
            <StatCard icon="fa-shield-halved"   label="Mitigated Risks" value={RISKS.filter(r => r.status === 'Mitigated').length} color="#16A34A" />
          </div>
          <div className="pmo-card" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'Project', 'Description', 'Impact', 'Likelihood', 'Owner', 'Status'].map(h => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RISKS.map((r, i) => {
                  const impactColor = r.impact === 'Critical' ? '#DC2626' : r.impact === 'High' ? '#D97706' : '#1D76BC';
                  const isOpen = r.status === 'Open';
                  return (
                    <tr key={r.id} style={{ borderBottom: i < RISKS.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                      <td style={{ padding: '11px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.id}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.project}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 280 }}>{r.description}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: impactColor }}>{r.impact}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{r.likelihood}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{r.owner}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{
                          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: isOpen ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)',
                          color: isOpen ? '#DC2626' : '#16A34A',
                          border: `1px solid ${isOpen ? '#DC262644' : '#16A34A44'}`,
                        }}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
