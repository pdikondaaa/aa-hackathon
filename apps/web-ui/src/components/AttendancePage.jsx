import React, { useState, useEffect, useCallback } from 'react';
import { getMyAttendance, getTeamAttendance } from '../services/api';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  full_day:    { label: 'Full Day',    color: '#4ED44E', bg: 'rgba(78,212,78,0.12)'  },
  half_day:    { label: 'Half Day',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  short:       { label: 'Short',       color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  no_checkout: { label: 'No Checkout', color: '#f05252', bg: 'rgba(240,82,82,0.12)'  },
};

// ── Shared primitives ────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#a8bdd4', bg: 'rgba(168,189,212,0.12)' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}33`, whiteSpace: 'nowrap',
    }}>{cfg.label}</span>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <div style={{
      flex: 1, minWidth: 130, background: 'var(--bg-card)',
      border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9, background: `${color}1a`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 15 }} />
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function Spinner({ text = 'Loading…' }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--primary)' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

function ErrorBox({ error, onRetry }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
      <i className="fas fa-circle-exclamation" style={{ fontSize: 32, color: 'var(--error)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Could not load data</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 440, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>{error}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />Retry
        </button>
      )}
    </div>
  );
}

// ── Daily records table ──────────────────────────────────────────────────────
function AttendanceTable({ records }) {
  if (!records || records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
        <i className="fas fa-calendar-xmark" style={{ fontSize: 26, marginBottom: 8, display: 'block' }} />
        No attendance records for this period.
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Date', 'Day', 'Check In', 'Check Out', 'Duration', 'Status'].map(h => (
              <th key={h} style={{ padding: '9px 14px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ padding: '10px 14px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{rec.date}</td>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{rec.day}</td>
              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                {rec.check_in ? <span style={{ color: '#4ED44E', fontWeight: 500 }}>{rec.check_in}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                {rec.check_out ? <span style={{ color: '#27AAE1', fontWeight: 500 }}>{rec.check_out}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </td>
              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{rec.duration_label || '—'}</td>
              <td style={{ padding: '10px 14px' }}><StatusBadge status={rec.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Month panel (shared between My Attendance and expanded reportee) ──────────
function MonthPanel({ thisMonth, lastMonth }) {
  const [activeTab, setActiveTab] = useState('this_month');
  const monthData = activeTab === 'this_month' ? thisMonth : lastMonth;

  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        {[
          { key: 'this_month', label: thisMonth?.month_label || 'This Month' },
          { key: 'last_month', label: lastMonth?.month_label || 'Last Month' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '11px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400,
            color: activeTab === t.key ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: activeTab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>
      {/* Month sub-summary */}
      {monthData && (
        <div style={{ display: 'flex', gap: 20, padding: '12px 18px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <i className="fas fa-calendar-days" style={{ color: 'var(--primary)', marginRight: 6 }} />
            <strong style={{ color: 'var(--text)' }}>{monthData.total_days}</strong> days present
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <i className="fas fa-clock" style={{ color: '#27AAE1', marginRight: 6 }} />
            <strong style={{ color: 'var(--text)' }}>{monthData.total_hours_label}</strong> worked
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = (monthData.records || []).filter(r => r.status === key).length;
              return count > 0 ? <span key={key} style={{ fontSize: 11, color: cfg.color }}><strong>{count}</strong> {cfg.label.toLowerCase()}</span> : null;
            })}
          </div>
        </div>
      )}
      <AttendanceTable records={monthData?.records} />
    </div>
  );
}

// ── MY ATTENDANCE view ───────────────────────────────────────────────────────
function MyAttendanceView({ user }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getMyAttendance()
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load attendance data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner text="Loading your attendance…" />;
  if (error)   return <ErrorBox error={error} onRetry={load} />;

  return (
    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SummaryCard icon="fa-calendar-days"  label="Days Present (Combined)"         value={data?.total_days_combined ?? 0}         color="#1D76BC" />
        <SummaryCard icon="fa-clock"           label="Hours Worked (Combined)"         value={data?.total_hours_combined ?? '—'}      color="#27AAE1" />
        <SummaryCard icon="fa-calendar-check"  label={data?.this_month?.month_label}   value={`${data?.this_month?.total_days ?? 0} days`}  color="#4ED44E" />
        <SummaryCard icon="fa-hourglass-half"  label={data?.this_month?.month_label}   value={data?.this_month?.total_hours_label ?? '—'} color="#2A3D90" />
      </div>
      <MonthPanel thisMonth={data?.this_month} lastMonth={data?.last_month} />
    </div>
  );
}

// ── MY TEAM view ─────────────────────────────────────────────────────────────
function getInitials(name) {
  return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name) {
  const colors = ['#1D76BC', '#27AAE1', '#2A3D90', '#4ED44E', '#f59e0b', '#f97316', '#8b5cf6', '#06b6d4'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function AttendanceBar({ records }) {
  if (!records || records.length === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No data</span>;
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      {records.slice(0, 22).map((r, i) => {
        const cfg = STATUS_CONFIG[r.status] || { color: '#a8bdd4' };
        return <div key={i} title={`${r.date}: ${r.duration_label}`} style={{ width: 10, height: 22, borderRadius: 3, background: cfg.color, opacity: 0.85, flexShrink: 0 }} />;
      })}
    </div>
  );
}

function ReporteeRow({ reportee }) {
  const [expanded, setExpanded] = useState(false);
  const color = avatarColor(reportee.name);

  return (
    <div style={{ borderBottom: '1px solid var(--border-light)' }}>
      {/* Summary row */}
      <div
        onClick={() => setExpanded(x => !x)}
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Avatar */}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {getInitials(reportee.name)}
        </div>

        {/* Name + dept */}
        <div style={{ minWidth: 180, flex: '0 0 180px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{reportee.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{reportee.designation || reportee.department || '—'}</div>
        </div>

        {/* This-month bar */}
        <div style={{ flex: 1, minWidth: 120 }}>
          <AttendanceBar records={reportee.this_month?.records} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, flexShrink: 0, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{reportee.total_days_combined}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>days</div>
          </div>
          <div style={{ textAlign: 'center', minWidth: 60 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#27AAE1' }}>{reportee.total_hours_combined}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>hours</div>
          </div>
        </div>

        {/* Expand chevron */}
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`} style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }} />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '4px 20px 20px', background: 'var(--bg)' }}>
          <MonthPanel thisMonth={reportee.this_month} lastMonth={reportee.last_month} />
        </div>
      )}
    </div>
  );
}

function MyTeamView() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [search, setSearch]   = useState('');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getTeamAttendance()
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load team attendance data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner text="Loading team attendance…" />;
  if (error)   return <ErrorBox error={error} onRetry={load} />;

  const reportees = (data?.reportees || []).filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.department?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDays  = (data?.reportees || []).reduce((s, r) => s + r.total_days_combined, 0);
  const avgDays    = data?.team_size ? (totalDays / data.team_size).toFixed(1) : 0;

  return (
    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Team summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SummaryCard icon="fa-users"          label="Direct Reports"        value={data?.team_size ?? 0}  color="#1D76BC" />
        <SummaryCard icon="fa-calendar-check" label="Avg Days Present"      value={avgDays}               color="#27AAE1" />
        <SummaryCard icon="fa-circle-check"   label="Members with data"     value={(data?.reportees || []).filter(r => r.total_days_combined > 0).length} color="#4ED44E" />
      </div>

      {/* Search + table */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <i className="fas fa-users" style={{ color: 'var(--primary)', fontSize: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            {data?.manager_name}'s Team &nbsp;<span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({data?.team_size} members)</span>
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {Object.values(STATUS_CONFIG).map(cfg => (
                <span key={cfg.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 10, height: 18, borderRadius: 3, background: cfg.color, opacity: 0.85, display: 'inline-block', flexShrink: 0 }} />
                  {cfg.label}
                </span>
              ))}
            </div>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px' }}>
              <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or dept…"
                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 12, width: 160 }}
              />
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 36, flexShrink: 0 }} />
          <div style={{ minWidth: 180, flex: '0 0 180px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employee</div>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>This Month</div>
          <div style={{ display: 'flex', gap: 24, flexShrink: 0 }}>
            <div style={{ minWidth: 50, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Days</div>
            <div style={{ minWidth: 60, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Hours</div>
          </div>
          <div style={{ width: 20, flexShrink: 0 }} />
        </div>

        {/* Rows */}
        {reportees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
            <i className="fas fa-user-slash" style={{ fontSize: 26, marginBottom: 8, display: 'block' }} />
            {search ? 'No match found.' : 'No direct reports found.'}
          </div>
        ) : (
          reportees.map(r => <ReporteeRow key={r.email} reportee={r} />)
        )}
      </div>
    </div>
  );
}

// ── Main AttendancePage ──────────────────────────────────────────────────────
export default function AttendancePage({ user }) {
  const [view, setView] = useState('mine');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Page header */}
      <div style={{ padding: '18px 28px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(29,118,188,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-calendar-check" style={{ color: 'var(--primary)', fontSize: 14 }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Attendance</h1>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{user?.name || ''}</div>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: 'flex' }}>
          {[
            { key: 'mine', label: 'My Attendance', icon: 'fa-user' },
            { key: 'team', label: 'My Team',        icon: 'fa-users' },
          ].map(t => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 13, fontWeight: view === t.key ? 600 : 400,
              color: view === t.key ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: view === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <i className={`fas ${t.icon}`} style={{ fontSize: 12 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {view === 'mine' ? <MyAttendanceView user={user} /> : <MyTeamView />}
      </div>
    </div>
  );
}
