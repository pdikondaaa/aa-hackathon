import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
  LineChart, Line, ReferenceLine,
  Treemap,
} from 'recharts';
import { cooAnalyticsApi } from '../services/cooAnalyticsApi';
import { getAllocationBoard, getEmployeeDetail, askAllocationAura } from '../../../services/api';

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  primary:   '#1D76BC',
  lightBlue: '#27AAE1',
  deepBlue:  '#2A3D90',
  green:     '#4ED44E',
  amber:     '#f59e0b',
  red:       '#f05252',
  muted:     '#5e7a9a',
  purple:    '#9b59b6',
  teal:      '#1abc9c',
};

const CHART_COLORS = [C.primary, C.lightBlue, C.deepBlue, C.green, C.amber, C.purple, C.teal, C.red];

// ── Industry benchmarks (IT Services, billable workforce) ─────────────────────
const BENCHMARKS = [
  { metric: 'Billable Effort Utilization', unit: '%', company_key: 'avg_efforts_pct',              industry: 85, good_above: true  },
  { metric: 'Billable Allocation Rate',    unit: '%', company_key: 'avg_billability_pct',           industry: 80, good_above: true  },
  { metric: 'Fully Allocated %',           unit: '%', company_key: '_fully_alloc_pct',             industry: 55, good_above: true  },
  { metric: 'Overallocated %',             unit: '%', company_key: '_over_pct',                    industry: 8,  good_above: false },
  { metric: 'Operational Efficiency',      unit: '%', company_key: 'operational_efficiency_score', industry: 78, good_above: true  },
];

// ── Date helpers ───────────────────────────────────────────────────────────────
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function resolveDefaultMonth(availableMonths) {
  if (!availableMonths?.length) return getCurrentMonthKey();
  const cur = getCurrentMonthKey();
  return availableMonths.includes(cur) ? cur : availableMonths[0];
}

function monthYearToDateRange(monthYear) {
  if (!monthYear) return {};
  const [year, month] = monthYear.split('-').map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { date_from: fmt(from), date_to: fmt(to) };
}

// ── Styled helpers ─────────────────────────────────────────────────────────────
const s = {
  page: {
    background: 'var(--bg)',
    minHeight: '100vh',
    padding: '0',
    overflowY: 'auto',
    fontFamily: 'var(--font)',
    color: 'var(--text)',
  },
  header: {
    background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
    borderBottom: '1px solid var(--border)',
    padding: '18px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${C.primary}, ${C.deepBlue})`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' },
  headerSub: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  body: { padding: '20px 24px', maxWidth: 1600, margin: '0 auto' },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 18px 10px',
    borderBottom: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.1px' },
  cardSub: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  cardBody: { padding: '16px 18px' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1.2px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    marginBottom: 12,
    marginTop: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid var(--border)', transition: 'all .15s',
  },
  tag: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, color = C.primary }) {
  return (
    <div style={{ ...s.sectionLabel, color: 'var(--text-secondary)' }}>
      <span style={{ width: 3, height: 14, borderRadius: 2, background: color, display: 'inline-block' }} />
      <i className={`fas ${icon}`} style={{ color, fontSize: 11 }} />
      {title}
    </div>
  );
}

function ChartCard({ title, subtitle, children, style = {}, onTableClick }) {
  return (
    <div style={{ ...s.card, ...style }}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardTitle}>{title}</div>
          {subtitle && <div style={s.cardSub}>{subtitle}</div>}
        </div>
        {onTableClick && (
          <button
            onClick={onTableClick}
            title="View data table"
            style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
              width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <i className="fas fa-table-list" style={{ fontSize: 11 }} />
          </button>
        )}
      </div>
      <div style={s.cardBody}>{children}</div>
    </div>
  );
}

function KPICard({ label, value, unit = '', icon, color, sub }) {
  return (
    <div style={{
      ...s.card,
      padding: '14px 16px',
      borderTop: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{ width: 28, height: 28, borderRadius: 7, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fas ${icon}`} style={{ color, fontSize: 11 }} />
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', lineHeight: 1.1 }}>
        {value}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function InsightCard({ type, icon, text }) {
  const colorMap = { success: C.green, warning: C.amber, risk: C.red, info: C.lightBlue };
  const bgMap    = { success: C.green + '12', warning: C.amber + '12', risk: C.red + '12', info: C.lightBlue + '12' };
  const color = colorMap[type] || C.muted;
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 14px',
      background: bgMap[type] || 'var(--bg-elevated)',
      borderRadius: 8, border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 28, height: 28, borderRadius: 7, background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <i className={`fas ${icon}`} style={{ color, fontSize: 11 }} />
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</span>
    </div>
  );
}

function BenchmarkRow({ metric, unit, companyVal, industry, goodAbove }) {
  const company = Math.round(companyVal || 0);
  const max = Math.max(industry * 1.4, company * 1.2, 100);
  const companyPct = (company / max) * 100;
  const industryPct = (industry / max) * 100;
  const isGood = goodAbove ? company >= industry : company <= industry;
  const statusColor = isGood ? C.green : company / industry > (goodAbove ? 0.85 : 1.15) ? C.amber : C.red;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{metric}</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{company}{unit}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs {industry}{unit} benchmark</span>
        </div>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--border)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${companyPct}%`, borderRadius: 3, background: statusColor, transition: 'width .4s' }} />
        <div style={{ position: 'absolute', top: -3, height: 12, width: 2, borderRadius: 1, background: 'var(--text-muted)', left: `${industryPct}%` }} />
      </div>
    </div>
  );
}

const MONTH_WINDOW = 6;

function MonthTimeline({ months, selectedMonth, onChange, topOffset = 70 }) {
  const stripRef = useRef(null);
  const sorted = [...months].reverse(); // oldest → newest
  const hasMore = sorted.length > MONTH_WINDOW;

  // Show all when the selected month is outside the recent window
  const recentSlice = sorted.slice(sorted.length - MONTH_WINDOW);
  const selectedIsOld = hasMore && !recentSlice.includes(selectedMonth);
  const [expanded, setExpanded] = useState(false);
  const showAll = expanded || selectedIsOld;
  const visible = showAll ? sorted : recentSlice;
  const hiddenCount = sorted.length - MONTH_WINDOW;

  useEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current.querySelector('[data-sel="true"]');
    if (el) el.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
  }, [selectedMonth, showAll]);

  const pillStyle = (active, muted) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 11,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    border: active ? `1.5px solid ${C.primary}` : muted ? '1px solid transparent' : '1px solid var(--border)',
    background: active ? C.primary : 'transparent',
    color: active ? '#fff' : muted ? 'var(--text-muted)' : 'var(--text-secondary)',
    transition: 'all .15s',
  });

  return (
    <div style={{
      position: 'sticky', top: topOffset, zIndex: 18,
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', whiteSpace: 'nowrap', flexShrink: 0 }}>PERIOD</span>

      {/* "N earlier" toggle — only appears when data grows beyond the window */}
      {hasMore && !showAll && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            ...pillStyle(false, false),
            background: 'var(--bg-elevated)',
            color: C.amber, borderColor: C.amber + '55',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
          title={`Show ${hiddenCount} older month${hiddenCount !== 1 ? 's' : ''}`}
        >
          <i className="fas fa-clock-rotate-left" style={{ fontSize: 10 }} />
          {hiddenCount} earlier
        </button>
      )}

      <div
        ref={stripRef}
        style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', padding: '8px 0', flex: 1 }}
      >
        {visible.map(m => (
          <button key={m} data-sel={m === selectedMonth} onClick={() => onChange(m)} style={pillStyle(m === selectedMonth, false)}>
            {formatMonthLabel(m)}
          </button>
        ))}
      </div>

      {/* Collapse back to recent — only when expanded beyond the default window */}
      {hasMore && showAll && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            ...pillStyle(false, false),
            background: 'var(--bg-elevated)',
            color: 'var(--text-muted)', borderColor: 'var(--border)',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
          title="Show recent months only"
        >
          <i className="fas fa-compress-alt" style={{ fontSize: 10 }} />
          Recent only
        </button>
      )}

      {/* Live indicator showing current window scope */}
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {showAll ? `${sorted.length} months` : `last ${Math.min(MONTH_WINDOW, sorted.length)}`}
      </span>
    </div>
  );
}

function FilterDrawer({ open, onClose, options, filters, onChange, defaultMonthKey }) {
  const currentMonthKey = defaultMonthKey || getCurrentMonthKey();

  const sel = (key, label) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 7, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <select
        value={filters[key] || ''}
        onChange={e => onChange({ ...filters, [key]: e.target.value || undefined })}
        style={{
          width: '100%', padding: '9px 12px', fontSize: 12, borderRadius: 8,
          background: 'var(--bg-elevated)', color: 'var(--text)',
          border: '1px solid var(--border)', cursor: 'pointer', outline: 'none',
        }}
      >
        <option value="">All</option>
        {(options[key] || []).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </div>
  );

  const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'monthYear' && Boolean(v)).length;

  return (
    <>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'rgba(0,0,0,0.28)', backdropFilter: 'blur(2px)' }} />
      )}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 30,
        width: 300,
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
        boxShadow: '-6px 0 32px rgba(0,0,0,0.18)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.26s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 7, background: C.primary + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-sliders" style={{ color: C.primary, fontSize: 12 }} />
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Filters</div>
              {activeCount > 0 && <div style={{ fontSize: 10, color: C.primary }}>{activeCount} active</div>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-xmark" style={{ fontSize: 12 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 0' }}>
          {sel('functions',         'Function')}
          {sel('subfunctions',      'Sub-Function')}
          {sel('clients',           'Client')}
          {sel('project_statuses',  'Project Status')}
          {sel('delivery_managers', 'Delivery Manager')}
        </div>
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeCount > 0 && (
            <button
              onClick={() => { onChange({ monthYear: filters.monthYear || currentMonthKey }); onClose(); }}
              style={{ ...s.btn, width: '100%', justifyContent: 'center', background: C.red + '14', borderColor: C.red + '40', color: C.red }}
            >
              <i className="fas fa-xmark" /> Clear Filters
            </button>
          )}
          <button onClick={onClose} style={{ ...s.btn, width: '100%', justifyContent: 'center', background: C.primary, color: '#fff', border: 'none' }}>
            Apply
          </button>
        </div>
      </div>
    </>
  );
}

function LoadingSkeleton() {
  const skBox = (h, w = '100%') => (
    <div style={{ height: h, width: w, borderRadius: 8, background: 'var(--border)', animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.5 }} />
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>{Array(5).fill(0).map((_, i) => <div key={i}>{skBox(90)}</div>)}</div>
      <div style={{ ...s.grid2 }}>{skBox(260)}{skBox(260)}</div>
      <div style={{ ...s.grid2 }}>{skBox(260)}{skBox(260)}</div>
      <div style={{ ...s.grid2 }}>{skBox(320)}{skBox(320)}</div>
    </div>
  );
}

function EmptyChart({ message = 'No data available' }) {
  return (
    <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
      <i className="fas fa-chart-column" style={{ fontSize: 28, opacity: 0.3 }} />
      <span style={{ fontSize: 12 }}>{message}</span>
    </div>
  );
}

const RAW_COLS = [
  { key: 'name',             label: 'Employee' },
  { key: 'project_name',     label: 'Project' },
  { key: 'client_master',    label: 'Client' },
  { key: 'function',         label: 'Function' },
  { key: 'efforts_pct',      label: 'Effort %',      right: true, format: v => v != null ? `${v}%` : '—' },
  { key: 'billability_pct',  label: 'Billability %', right: true, format: v => v != null ? `${v}%` : '—' },
  { key: 'project_status',   label: 'Status' },
  { key: 'delivery_manager', label: 'DM' },
];

const ALLOC_FILTER_MAP = {
  'Fully Allocated':  'fully_allocated',
  'Underallocated':   'underallocated',
  'Overallocated':    'overallocated',
  'Zero / No Effort': 'zero',
};

function DataModal({ modal, onClose }) {
  if (!modal) return null;
  const { title, rows = [], loading, error } = modal;
  const columns = RAW_COLS;
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, width: '100%', maxWidth: 860, maxHeight: '78vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {loading ? 'Loading…' : error ? 'Error loading data' : `${rows.length} record${rows.length !== 1 ? 's' : ''}${rows.length === 500 ? ' (capped at 500)' : ''}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', color: 'var(--text-secondary)', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--text-muted)' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 22 }} />
              <span style={{ fontSize: 12 }}>Loading records…</span>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: C.red }}>
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 22 }} />
              <span style={{ fontSize: 12 }}>{error}</span>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--text-muted)' }}>
              <i className="fas fa-inbox" style={{ fontSize: 22, opacity: 0.4 }} />
              <span style={{ fontSize: 12 }}>No records found</span>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  {columns.map((col, i) => (
                    <th key={i} style={{ padding: '10px 14px', textAlign: col.right ? 'right' : 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.4px', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg-secondary)', whiteSpace: 'nowrap' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 1 ? 'var(--bg-elevated)' : 'transparent' }}>
                    {columns.map((col, j) => (
                      <td key={j} style={{ padding: '8px 14px', color: 'var(--text)', borderBottom: '1px solid var(--border-light)', textAlign: col.right ? 'right' : 'left', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span title={row[col.key] != null ? String(row[col.key]) : ''}>
                          {col.format ? col.format(row[col.key], row) : (row[col.key] ?? '—')}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600 }}>{name}</div>
      <div style={{ color: payload[0].payload.color || C.primary }}>{value} employees</div>
    </div>
  );
};

const CustomScatterTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload || {};
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.function}</div>
      <div>Effort: <strong>{d.avg_efforts}%</strong></div>
      <div>Billability: <strong>{d.avg_billability}%</strong></div>
      <div>Headcount: <strong>{d.headcount}</strong></div>
    </div>
  );
};

const CustomTreemapContent = ({ x, y, width, height, name, value }) => {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={C.primary} fillOpacity={0.15 + (value / 100) * 0.6} stroke="var(--border)" strokeWidth={1} rx={4} />
      {width > 60 && height > 30 && (
        <>
          <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="var(--text)" fontSize={11} fontWeight={600}>{name}</text>
          <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill={C.lightBlue} fontSize={10}>{value}%</text>
        </>
      )}
    </g>
  );
};

function heatColor(val, min = 0, max = 100) {
  if (val === null || val === undefined) return 'var(--border)';
  if (val >= 80) return C.green + '30';
  if (val >= 60) return C.amber + '25';
  return C.red + '20';
}

function heatText(val) {
  if (val === null || val === undefined) return 'var(--text-muted)';
  if (val >= 80) return C.green;
  if (val >= 60) return C.amber;
  return C.red;
}

// ── COO Analytics Dashboard (named export — backup of original COO analytics code) ──
export function COOAnalyticsDashboard({ hideHeader = false, monthTopOffset }) {
  const [data,          setData]          = useState(null);
  const [filterOptions, setFilterOptions] = useState({});
  const [filters,       setFilters]       = useState({ monthYear: getCurrentMonthKey() });
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [modal,            setModal]            = useState(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const closeModal = () => setModal(null);

  const openRawModal = async (title, groupKey = null, groupValue = null, allocationFilter = null) => {
    setModal({ title, rows: [], loading: true });
    try {
      const dateRange = monthYearToDateRange(filters.monthYear);
      const apiFilters = {
        function:         filters.functions,
        subfunction:      filters.subfunctions,
        client:           filters.clients,
        project_status:   filters.project_statuses,
        delivery_manager: filters.delivery_managers,
        date_from:        dateRange.date_from,
        date_to:          dateRange.date_to,
      };
      const rows = await cooAnalyticsApi.getRawRecords(apiFilters, groupKey, groupValue, allocationFilter);
      setModal({ title, rows, loading: false });
    } catch (e) {
      setModal({ title, rows: [], loading: false, error: e.message || 'Failed to load records' });
    }
  };

  const load = useCallback(async (activeFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const dateRange = monthYearToDateRange(activeFilters.monthYear);
      const apiFilters = {
        function:         activeFilters.functions,
        subfunction:      activeFilters.subfunctions,
        client:           activeFilters.clients,
        project_status:   activeFilters.project_statuses,
        delivery_manager: activeFilters.delivery_managers,
        date_from:        dateRange.date_from,
        date_to:          dateRange.date_to,
      };
      const result = await cooAnalyticsApi.getDashboard(apiFilters);
      setData(result);
    } catch (e) {
      setError(e.message || 'Failed to load COO Analytics data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cooAnalyticsApi.getFilterOptions()
      .then(opts => {
        setFilterOptions(opts);
        const defaultMonth = resolveDefaultMonth(opts.available_months);
        const initialFilters = { monthYear: defaultMonth };
        setFilters(initialFilters);
        load(initialFilters);
      })
      .catch(() => load(filters));
  }, []);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    load(newFilters);
  };

  if (error) {
    return (
      <div style={s.page}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 12, color: 'var(--text-muted)' }}>
          <i className="fas fa-triangle-exclamation" style={{ fontSize: 40, color: C.red, opacity: 0.7 }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Failed to load COO Analytics</div>
          <div style={{ fontSize: 13 }}>{error}</div>
          <button onClick={() => load(filters)} style={{ ...s.btn, background: C.primary, color: '#fff', border: 'none', padding: '9px 20px' }}>
            <i className="fas fa-rotate-right" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const overPct = kpis.total_billable_employees > 0
    ? Math.round((kpis.overallocated_employees / kpis.total_billable_employees) * 100)
    : 0;

  const fullyAllocPct = kpis.total_billable_employees > 0
    ? Math.round((kpis.fully_allocated_employees / kpis.total_billable_employees) * 100) : 0;

  const benchmarkData = kpis.total_billable_employees > 0
    ? BENCHMARKS.map(b => ({
        ...b,
        companyVal: b.company_key === '_over_pct' ? overPct
                  : b.company_key === '_fully_alloc_pct' ? fullyAllocPct
                  : (kpis[b.company_key] || 0),
      }))
    : [];

  return (
    <div style={s.page}>
      {/* ── Header ──────────────────────────────────────────── */}
      {!hideHeader && <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.headerIcon}>
            <i className="fas fa-gauge-high" style={{ color: '#fff', fontSize: 16 }} />
          </div>
          <div>
            <div style={s.headerTitle}>COO Analytics Dashboard</div>
            <div style={s.headerSub}>Operational Intelligence Cockpit · Billable Projects Only · Live data from allocation_details</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {data && <span style={{ ...s.tag, background: C.green + '20', color: C.green }}>
            <i className="fas fa-circle" style={{ fontSize: 7 }} /> Live
          </span>}
          {(() => {
            const activeCount = Object.entries(filters).filter(([k, v]) => k !== 'monthYear' && Boolean(v)).length;
            return (
              <button
                onClick={() => setFilterDrawerOpen(true)}
                style={{ ...s.btn, background: activeCount > 0 ? C.primary + '15' : 'var(--bg-elevated)', color: activeCount > 0 ? C.primary : 'var(--text-secondary)', borderColor: activeCount > 0 ? C.primary + '55' : 'var(--border)', position: 'relative' }}
              >
                <i className="fas fa-sliders" />
                Filters
                {activeCount > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -5, background: C.primary, color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px' }}>
                    {activeCount}
                  </span>
                )}
              </button>
            );
          })()}
          <button
            onClick={() => load(filters)}
            style={{ ...s.btn, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            disabled={loading}
          >
            <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>}

      {/* ── Month Timeline ────────────────────────────────────── */}
      {(filterOptions.available_months?.length > 0) && (
        <MonthTimeline
          months={filterOptions.available_months}
          selectedMonth={filters.monthYear}
          onChange={m => handleFilterChange({ ...filters, monthYear: m })}
          topOffset={monthTopOffset !== undefined ? monthTopOffset : (hideHeader ? 0 : 70)}
        />
      )}

      {/* ── Filter Drawer ─────────────────────────────────────── */}
      <FilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        options={filterOptions}
        filters={filters}
        onChange={handleFilterChange}
        defaultMonthKey={resolveDefaultMonth(filterOptions.available_months)}
      />

      <div style={s.body}>

        {loading && !data ? <LoadingSkeleton /> : (
          <>
            {/* ── KPI Strip ───────────────────────────────────────── */}
            <SectionHeader icon="fa-square-poll-vertical" title="KEY PERFORMANCE INDICATORS" color={C.primary} />
            <div style={{ ...s.kpiGrid, marginBottom: 24 }}>
              <KPICard label="Billable Employees"        value={kpis.total_billable_employees ?? '—'}     unit=""  icon="fa-users"          color={C.primary}   sub="On active billable projects" />
              <KPICard label="Underallocated"            value={kpis.underallocated_employees ?? '—'}     unit=""  icon="fa-user-clock"      color={C.amber}     sub="Unused billable capacity" />
              <KPICard label="Active Clients"            value={kpis.active_clients ?? '—'}               unit=""  icon="fa-building"        color={C.deepBlue}  sub="Billable client accounts" />
              <KPICard label="Active Billable Projects"  value={kpis.active_projects ?? '—'}              unit=""  icon="fa-diagram-project" color={C.purple}    sub="Ongoing engagements" />
              <KPICard label="Operational Efficiency"    value={kpis.operational_efficiency_score ?? '—'} unit="%" icon="fa-gear"            color={C.teal}      sub="Effort + billability avg" />
            </div>

            {/* ── Section 1: Revenue & Client Capacity ─────────────── */}
            <SectionHeader icon="fa-building-columns" title="REVENUE & CLIENT CAPACITY" color={C.lightBlue} />
            <div style={{ ...s.grid2, marginBottom: 16 }}>

              {/* Chart: Client Contribution */}
              <ChartCard
                title="Top Client Contribution"
                subtitle="Headcount & avg billability by client"
                onTableClick={() => openRawModal('Top Client Contribution — All Records')}
              >
                {!(data?.client_contribution?.length) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.client_contribution.slice(0, 10)} margin={{ top: 20, right: 16, left: -10, bottom: 70 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="client_master"
                        tick={({ x, y, payload }) => {
                          const label = payload.value || '';
                          const truncated = label.length > 16 ? label.slice(0, 15) + '…' : label;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text x={0} y={0} dy={10} textAnchor="end" fill="var(--text-secondary)" fontSize={10} transform="rotate(-40)">
                                <title>{label}</title>
                                {truncated}
                              </text>
                            </g>
                          );
                        }}
                        interval={0}
                      />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v, name === 'headcount' ? 'Resources' : 'Avg Billability %']}
                      />
                      <Bar
                        dataKey="headcount" name="Resources" fill={C.primary} radius={[4, 4, 0, 0]} barSize={28}
                        onClick={(d) => openRawModal(`Client: ${d.client_master}`, 'client_master', d.client_master)}
                        style={{ cursor: 'pointer' }}
                      >
                        {(data.client_contribution || []).slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                        <LabelList dataKey="headcount" position="top" style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Top Billable Projects */}
              <ChartCard
                title="Top Billable Projects by Headcount"
                subtitle="Resource count per active billable project"
                onTableClick={() => openRawModal('Top Billable Projects — All Records')}
              >
                {!(data?.top_projects?.length) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.top_projects.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <YAxis
                        dataKey="project_name"
                        type="category"
                        width={170}
                        tick={({ x, y, payload }) => {
                          const label = payload.value || '';
                          const truncated = label.length > 24 ? label.slice(0, 23) + '…' : label;
                          return (
                            <text x={x} y={y} dy={4} textAnchor="end" fill="var(--text-secondary)" fontSize={10}>
                              <title>{label}</title>
                              {truncated}
                            </text>
                          );
                        }}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v, name === 'headcount' ? 'Resources' : name]}
                        labelFormatter={label => <span style={{ fontWeight: 600 }}>{label}</span>}
                      />
                      <Bar
                        dataKey="headcount" name="Resources" radius={[0, 4, 4, 0]} barSize={12}
                        onClick={(d) => openRawModal(`Project: ${d.project_name}`, 'project_name', d.project_name)}
                        style={{ cursor: 'pointer' }}
                      >
                        {(data.top_projects || []).slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                        <LabelList dataKey="headcount" position="right" style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Client Concentration Risk — full-width, stays with client view */}
            <ChartCard
              title="Client Concentration Risk"
              subtitle="Share of billable workforce per client — larger tile = higher dependency"
              style={{ marginBottom: 24 }}
              onTableClick={() => openRawModal('Client Concentration — All Records')}
            >
              {!(data?.client_concentration?.length) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <Treemap
                    data={data.client_concentration.map(d => ({ name: d.client, size: d.headcount, value: d.share_pct }))}
                    dataKey="size"
                    nameKey="name"
                    content={<CustomTreemapContent />}
                  />
                </ResponsiveContainer>
              )}
              {data?.client_concentration?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {data.client_concentration.slice(0, 8).map((c, i) => (
                    <span key={i} style={{ ...s.tag, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                      {c.client} <strong style={{ color: 'var(--text)' }}>{c.share_pct}%</strong>
                    </span>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* ── Section 2: Workforce Delivery Health ─────────────── */}
            <SectionHeader icon="fa-heart-pulse" title="WORKFORCE DELIVERY HEALTH" color={C.green} />
            <div style={{ ...s.grid2, marginBottom: 24 }}>

              {/* Chart: Allocation Distribution */}
              <ChartCard
                title="Workforce Allocation Distribution"
                subtitle="Fully / Under / Over / Without allocation"
                onTableClick={() => openRawModal('Workforce Allocation Distribution')}
              >
                {(data?.allocation_distribution || []).every(d => d.value === 0) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data?.allocation_distribution || []}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(d) => openRawModal(`Allocation: ${d.name}`, null, null, ALLOC_FILTER_MAP[d.name])}
                        style={{ cursor: 'pointer' }}
                      >
                        {(data?.allocation_distribution || []).map((d, i) => (
                          <Cell key={i} fill={d.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                      <Legend
                        formatter={(value, entry) => (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value} ({entry.payload.value})</span>
                        )}
                        iconSize={8}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Chart: Allocation Trend */}
              <ChartCard
                title="Allocation Trend Over Time"
                subtitle="Last 12 months · not affected by month filter"
                onTableClick={() => openRawModal('Allocation Trend — All Records')}
              >
                {!(data?.allocation_trend?.length) ? <EmptyChart message="No date-based trend data available" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data.allocation_trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gEff" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.primary} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.primary} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gBill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={C.green} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis domain={[0, 110]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} unit="%" />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                      />
                      <Area type="monotone" dataKey="efforts"     name="Avg Effort %"      stroke={C.primary} fill="url(#gEff)"  strokeWidth={2} dot={{ r: 3, fill: C.primary }} />
                      <Area type="monotone" dataKey="billability" name="Avg Billability %"  stroke={C.green}   fill="url(#gBill)" strokeWidth={2} dot={{ r: 3, fill: C.green }} />
                      <Legend formatter={v => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>} iconSize={8} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* ── Section 3: Business Unit Performance ─────────────── */}
            <SectionHeader icon="fa-sitemap" title="BUSINESS UNIT PERFORMANCE" color={C.deepBlue} />
            <div style={{ ...s.grid2, marginBottom: 24 }}>

              {/* Chart 6: Function Efficiency Heatmap */}
              <ChartCard
                title="Function × Sub-Function Efficiency"
                subtitle="Avg effort %, avg billability %, headcount"
                onTableClick={() => openRawModal('Function Efficiency — All Records')}
              >
                {!(data?.function_efficiency?.length) ? <EmptyChart /> : (
                  <div style={{ overflowY: 'auto', maxHeight: 320 }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', fontSize: 11 }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>Function</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600 }}>Sub-Function</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>HC</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>Effort%</th>
                          <th style={{ padding: '4px 8px', fontWeight: 600, textAlign: 'right' }}>Bill%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.function_efficiency.map((r, i) => (
                          <tr key={i} onClick={() => openRawModal(`Function: ${r.function}`, 'function', r.function)} style={{ background: 'var(--bg-elevated)', borderRadius: 6, cursor: 'pointer' }}>
                            <td style={{ padding: '5px 8px', color: 'var(--text)', fontWeight: 500, borderRadius: '6px 0 0 6px' }}>{r.function}</td>
                            <td style={{ padding: '5px 8px', color: 'var(--text-secondary)' }}>{r.subfunction || '—'}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--text)' }}>{r.headcount}</td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', background: heatColor(r.avg_efforts), borderRadius: 4 }}>
                              <span style={{ color: heatText(r.avg_efforts), fontWeight: 600 }}>{r.avg_efforts ?? '—'}%</span>
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', background: heatColor(r.avg_billability), borderRadius: '0 6px 6px 0' }}>
                              <span style={{ color: heatText(r.avg_billability), fontWeight: 600 }}>{r.avg_billability ?? '—'}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>

              {/* Chart 7: Delivery Load — Line Chart */}
              <ChartCard
                title="Delivery Load by Function"
                subtitle="Avg effort % vs avg billability % per function"
                onTableClick={() => openRawModal('Delivery Load — All Records')}
              >
                {!(data?.delivery_load?.length) ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart
                        data={data.delivery_load}
                        margin={{ top: 16, right: 24, left: -10, bottom: 10 }}
                        onClick={d => {
                          if (!d?.activePayload) return;
                          const fn = d.activeLabel;
                          openRawModal(`Function: ${fn}`, 'function', fn);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="function"
                          tick={({ x, y, payload }) => {
                            const label = payload.value || '';
                            const initials = label.split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase();
                            return (
                              <g transform={`translate(${x},${y})`}>
                                <text x={0} y={0} dy={12} textAnchor="middle" fill="var(--text-secondary)" fontSize={11} fontWeight={600}>
                                  <title>{label}</title>
                                  {initials}
                                </text>
                              </g>
                            );
                          }}
                          interval={0}
                          height={28}
                        />
                        <YAxis
                          domain={[0, 110]}
                          unit="%"
                          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v, name) => [`${v}%`, name]}
                          labelStyle={{ color: 'var(--text)', fontWeight: 600 }}
                        />
                        <Legend
                          verticalAlign="top"
                          iconSize={8}
                          formatter={v => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>}
                        />
                        <ReferenceLine y={80} stroke={C.amber} strokeDasharray="4 3" strokeWidth={1.2}
                          label={{ value: 'Target 80%', position: 'insideTopRight', fontSize: 9, fill: C.amber }} />
                        <Line
                          type="monotone"
                          dataKey="avg_efforts"
                          name="Avg Effort %"
                          stroke={C.primary}
                          strokeWidth={2}
                          dot={{ r: 4, fill: C.primary, strokeWidth: 0 }}
                          activeDot={{ r: 6 }}
                          label={{ position: 'top', fontSize: 9, fill: C.primary, formatter: v => `${v}%` }}
                        />
                        <Line
                          type="monotone"
                          dataKey="avg_billability"
                          name="Avg Billability %"
                          stroke={C.green}
                          strokeWidth={2}
                          dot={{ r: 4, fill: C.green, strokeWidth: 0 }}
                          activeDot={{ r: 6 }}
                          label={{ position: 'bottom', fontSize: 9, fill: C.green, formatter: v => `${v}%` }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {data.delivery_load.map((d, i) => (
                        <span key={i} style={{ ...s.tag, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', fontSize: 10 }}>
                          HC: <strong style={{ color: 'var(--text)' }}>{d.headcount}</strong> · {d.function}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>
            </div>

            {/* ── Section 4 & 5: Insights + Benchmarks ─────────────── */}
            <div style={{ ...s.grid2, marginBottom: 24 }}>

              {/* Section 4: AI Insights */}
              <ChartCard title="Strategic Insights" subtitle="AI-generated observations from live allocation data">
                {!(data?.insights?.length) ? <EmptyChart message="No insights generated" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {data.insights.map((ins, i) => (
                      <InsightCard key={i} type={ins.type} icon={ins.icon} text={ins.text} />
                    ))}
                  </div>
                )}
              </ChartCard>

              {/* Section 5: Market Benchmarking */}
              <ChartCard title="Market Benchmarking" subtitle="Company performance vs IT services industry averages">
                {!data ? <EmptyChart /> : (
                  <div>
                    <div style={{ display: 'flex', gap: 20, marginBottom: 16, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 10, height: 4, background: C.green, borderRadius: 2, display: 'inline-block' }} /> Your Company
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <span style={{ width: 2, height: 12, background: 'var(--text-muted)', display: 'inline-block', borderRadius: 1 }} /> Industry Benchmark
                      </div>
                    </div>
                    {benchmarkData.map((b, i) => (
                      <BenchmarkRow key={i} metric={b.metric} unit={b.unit} companyVal={b.companyVal} industry={b.industry} goodAbove={b.good_above} />
                    ))}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, textAlign: 'center' }}>
                      Benchmarks based on IT Services industry averages (Gartner / NASSCOM 2024)
                    </div>
                  </div>
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>

      <DataModal modal={modal} onClose={closeModal} />

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// BACKUP: Executive View — copied from AllocationBoard.jsx (vice-versa swap)
// The default export COODashboard now renders this Executive View with
// allocation board data, while the allocation board executive slot shows
// COOAnalyticsDashboard above.
// ════════════════════════════════════════════════════════════════════════════════

const EXEC_CHART_COLORS = ['#1D76BC', '#27AAE1', '#4ED44E', '#2A3D90', '#f59e0b', '#ef4444', '#a78bfa', '#10b981'];
const EXEC_BILLING_EXCLUDE = ['Pipeline', 'Sales'];

function execFmt(val) {
  if (val === null || val === undefined || val === '') return '—';
  return val;
}

function execFmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString(); } catch { return val; }
}

function execGetBillabilityBucket(pct) {
  if (pct === null || pct === undefined) return 'Unknown';
  if (pct === 0) return '0%';
  if (pct < 50) return '1-49%';
  if (pct < 100) return '50-99%';
  return '100%';
}

function execGetEffortBucket(pct) {
  if (pct === null || pct === undefined || pct === 0) return '0%';
  if (pct < 50)   return '1-49%';
  if (pct < 100)  return '50-99%';
  if (pct === 100) return '100%';
  return '>100%';
}

function ExecTruncatedYTick({ x, y, payload, maxChars = 26 }) {
  const full = (payload.value || '').toString();
  const words = full.split(' ');
  let label = '';
  for (const w of words) {
    if ((label + w).length > maxChars) { label = label.trimEnd() + '…'; break; }
    label += w + ' ';
  }
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      <text x={-6} y={0} dy={4} textAnchor="end" fill="var(--text-secondary)" fontSize={11}>
        {label.trimEnd()}
      </text>
    </g>
  );
}

function ExecKpiCard({ value, label, accent, onClick, icon }) {
  return (
    <div
      className={`ab-kpi${accent ? ` ab-kpi--${accent}` : ''}${onClick ? ' ab-kpi--clickable' : ''}`}
      onClick={onClick}
    >
      {icon && <div className="ab-kpi-icon"><i className={`fas ${icon}`} /></div>}
      <div className="ab-kpi-body">
        <div className="ab-kpi-value">{value}</div>
        <div className="ab-kpi-label">{label}</div>
      </div>
    </div>
  );
}

function ExecChartCard({ title, children, wide, full, hint }) {
  return (
    <div className={`ab-chart-card${wide ? ' ab-chart-card--wide' : ''}${full ? ' ab-chart-card--full' : ''}`}>
      <div className="ab-chart-title-row">
        <h3 className="ab-chart-title">{title}</h3>
        {hint && <span className="ab-chart-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function ExecDrillModal({ drill, onClose, onRowClick }) {
  if (!drill) return null;
  return (
    <div className="ab-drill-overlay" onClick={onClose}>
      <div className="ab-drill-modal" onClick={e => e.stopPropagation()}>
        <div className="ab-drill-header">
          <h4>{drill.title}</h4>
          <span className="ab-count">{drill.rows.length} records</span>
          <button className="ab-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="ab-drill-body">
          {drill.rows.length === 0 ? (
            <p className="ab-empty">No records for this selection.</p>
          ) : (
            <div className="ab-table-wrap">
              <table className="ab-table">
                <thead>
                  <tr>{drill.columns.map(c => <th key={c}>{drill.colLabels?.[c] || c}</th>)}</tr>
                </thead>
                <tbody>
                  {drill.rows.map((r, i) => (
                    <tr
                      key={i}
                      className={onRowClick ? 'ab-tr-click' : ''}
                      onClick={() => onRowClick && onRowClick(r)}
                    >
                      {drill.columns.map(c => (
                        <td key={c}>
                          {c === 'efforts_pct' && r[c] != null ? `${r[c]}%`
                            : c === 'billability_pct' && r[c] != null ? `${r[c]}%`
                            : execFmt(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EXEC_COL_LABELS_BACKUP = {
  name: 'Name', designation: 'Designation', function: 'Function',
  project_name: 'Project', project_status: 'Status', billing: 'Billing',
  efforts_pct: 'Effort %', billability_pct: 'Billability %',
  location: 'Location', exp_group: 'Exp Group', employee_type: 'Emp Type',
  delivery_manager: 'Delivery Mgr', functional_manager: 'Functional Mgr',
};

const EXEC_BASE_COLS_BACKUP = ['name', 'designation', 'function', 'project_name', 'billing', 'efforts_pct', 'billability_pct'];

function ExecEmpDrawer({ emp, loading, onClose }) {
  if (!emp && !loading) return null;
  return (
    <>
      <div className="ab-drawer-overlay" onClick={onClose} />
      <div className="ab-drawer open">
        {loading ? (
          <div className="ab-drawer-loading"><div className="ab-spinner" /></div>
        ) : (
          <>
            <div className="ab-drawer-header">
              <div className="ab-drawer-avatar">{(emp?.name || '?')[0].toUpperCase()}</div>
              <div className="ab-drawer-title-block">
                <h3 className="ab-drawer-name">{emp?.name}</h3>
                <span className="ab-desig-text">{execFmt(emp?.designation)}</span>
              </div>
              <button className="ab-detail-close" onClick={onClose}>✕</button>
            </div>
            <div className="ab-drawer-body">
              <div className="ab-drawer-section">
                <div className="ab-drawer-section-label">Employee Info</div>
                <div className="ab-drawer-grid">
                  {[
                    ['Employee ID', emp?.employee_id],
                    ['Email',       emp?.email],
                    ['Function',    emp?.function],
                    ['Sub-function',emp?.subfunction],
                    ['Location',    emp?.location],
                    ['Experience',  emp?.total_experience_years != null ? `${emp.total_experience_years} yrs` : null],
                    ['Skills',      emp?.primary_skills],
                    ['Reports To',  emp?.reporting_manager],
                  ].map(([label, val]) => (
                    <div key={label} className="ab-drawer-row">
                      <span className="ab-label">{label}</span>
                      <span>{execFmt(val)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ab-drawer-section">
                <div className="ab-drawer-section-label">Allocation</div>
                <div className="ab-drawer-grid">
                  {[
                    ['Project',     emp?.project_name],
                    ['Sub-Project', emp?.sub_project],
                    ['Project Status', emp?.project_status],
                    ['Billing',     emp?.billing],
                    ['SOW',         emp?.sow_name],
                    ['Alloc. Date', emp?.allocation_date ? execFmtDate(emp.allocation_date) : null],
                  ].map(([label, val]) => (
                    <div key={label} className="ab-drawer-row">
                      <span className="ab-label">{label}</span>
                      <span>{execFmt(val)}</span>
                    </div>
                  ))}
                  {emp?.efforts_pct !== null && emp?.efforts_pct !== undefined && (
                    <div className="ab-drawer-row">
                      <span className="ab-label">Effort %</span>
                      <span>{emp.efforts_pct}%</span>
                    </div>
                  )}
                  {emp?.billability_pct !== null && emp?.billability_pct !== undefined && (
                    <div className="ab-drawer-row">
                      <span className="ab-label">Billability %</span>
                      <span>{emp.billability_pct}%</span>
                    </div>
                  )}
                  {emp?.completion_status !== null && emp?.completion_status !== undefined && (
                    <div className="ab-drawer-row">
                      <span className="ab-label">Completion</span>
                      <span>{emp.completion_status}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function ExecutiveView({ data, onEmployeeClick }) {
  const { analytics, allocation_rows } = data;
  const [search,    setSearch]    = useState('');
  const [drillDown, setDrillDown] = useState(null);

  const rows = allocation_rows || [];

  const kpis = useMemo(() => {
    const empSet   = new Set(rows.map(r => r.employee_id).filter(Boolean));
    const projSet  = new Set(rows.filter(r => r.project_name && r.project_name.toLowerCase() !== 'no allocation').map(r => r.project_name));
    const billable = new Set(rows.filter(r => (r.billing || '').toLowerCase() === 'billable').map(r => r.employee_id)).size;
    const bench    = (analytics?.available_pool || []).length;
    return { headcount: empSet.size, projects: projSet.size, billable, bench };
  }, [rows, analytics]);

  const drill = useCallback((title, filterFn, columns = EXEC_BASE_COLS_BACKUP) => {
    setDrillDown({ title, rows: rows.filter(filterFn), columns, colLabels: EXEC_COL_LABELS_BACKUP });
  }, [rows]);

  const drillProjects = useCallback(() => {
    const map = {};
    rows.filter(r => r.project_name && r.project_name.toLowerCase() !== 'no allocation')
      .forEach(r => {
        const p = r.project_name;
        if (!map[p]) map[p] = { project_name: p, project_status: r.project_status, billing: r.billing, delivery_manager: r.delivery_manager, project_lead: r.project_lead, resources: 0 };
        map[p].resources++;
      });
    setDrillDown({
      title: 'Active Projects',
      rows: Object.values(map).sort((a, b) => b.resources - a.resources),
      columns: ['project_name', 'project_status', 'billing', 'resources', 'delivery_manager', 'project_lead'],
      colLabels: { project_name: 'Project', project_status: 'Status', billing: 'Billing', resources: 'Resources', delivery_manager: 'Delivery Mgr', project_lead: 'Project Lead' },
    });
  }, [rows]);

  const billingData = useMemo(() =>
    (analytics?.billing_breakdown || []).filter(r => !EXEC_BILLING_EXCLUDE.includes(r.billing)),
    [analytics]
  );

  const filtered = useMemo(() => {
    if (!search) return rows;
    const sq = search.toLowerCase();
    return rows.filter(r =>
      (r.name || '').toLowerCase().includes(sq) ||
      (r.project_name || '').toLowerCase().includes(sq) ||
      (r.function || '').toLowerCase().includes(sq)
    );
  }, [rows, search]);

  const barH    = (items) => Math.max(220, (items?.length || 0) * 36);
  const barHGrp = (items) => Math.max(280, (items?.length || 0) * 56);

  return (
    <div className="ab-analytics">

      <div className="ab-kpi-row">
        <ExecKpiCard value={kpis.headcount} label="Total Employees"    accent="blue"   icon="fa-users"
          onClick={() => drill('All Employees', () => true)} />
        <ExecKpiCard value={kpis.projects}  label="Active Projects"    accent="purple" icon="fa-briefcase"
          onClick={drillProjects} />
        <ExecKpiCard value={kpis.billable}  label="Billable Resources" accent="green"  icon="fa-chart-line"
          onClick={() => drill('Billable Resources', r => (r.billing || '').toLowerCase() === 'billable')} />
        <ExecKpiCard value={kpis.bench}     label="On Bench"           accent="amber"  icon="fa-hourglass-half"
          onClick={() => drill('On Bench', r => (r.project_name || '').toLowerCase() === 'no allocation')} />
      </div>

      <div className="ab-charts-grid">

        <ExecChartCard title="Headcount by Function" wide hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={barH(analytics?.function_headcount)}>
            <BarChart data={analytics?.function_headcount || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="function" type="category" width={185} tick={<ExecTruncatedYTick />} />
              <Tooltip />
              <Bar dataKey="headcount" name="Headcount" fill={EXEC_CHART_COLORS[0]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Function — ${d.function}`, r => r.function === d.function)} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Billing Mix" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={billingData}>
              <XAxis dataKey="billing" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="project_count" name="Projects" fill={EXEC_CHART_COLORS[0]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => drill(`Billing — ${d.billing}`, r => r.billing === d.billing)} />
              <Bar dataKey="resource_count" name="Resources" fill={EXEC_CHART_COLORS[1]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => drill(`Billing — ${d.billing}`, r => r.billing === d.billing)} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Top Projects by Headcount" wide hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={barH(analytics?.top_projects)}>
            <BarChart data={analytics?.top_projects || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="project_name" type="category" width={200} tick={<ExecTruncatedYTick maxChars={24} />} />
              <Tooltip formatter={(v) => [v, 'Resources']} />
              <Bar dataKey="resource_count" name="Resources" fill={EXEC_CHART_COLORS[3]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Project — ${d.project_name}`, r => r.project_name === d.project_name)} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Billability by Function" wide hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={barHGrp(analytics?.function_billability)}>
            <BarChart data={analytics?.function_billability || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="function" type="category" width={185} tick={<ExecTruncatedYTick />} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total"    name="Total"   fill={EXEC_CHART_COLORS[0]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Function — ${d.function}`, r => r.function === d.function)} />
              <Bar dataKey="billable" name="Billable" fill={EXEC_CHART_COLORS[2]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Billable — ${d.function}`, r => r.function === d.function && (r.billing||'').toLowerCase() === 'billable')} />
              <Bar dataKey="bench"    name="Bench"    fill={EXEC_CHART_COLORS[4]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Bench — ${d.function}`, r => r.function === d.function && (r.project_name||'').toLowerCase() === 'no allocation')} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Experience Distribution" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.experience_distribution || []}>
              <XAxis dataKey="exp_group" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Employees" fill={EXEC_CHART_COLORS[5]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => drill(`Experience — ${d.exp_group}`, r => r.exp_group === d.exp_group,
                  ['name', 'designation', 'function', 'project_name', 'billing', 'exp_group'])} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Location Distribution" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={barH(analytics?.headcount_by_location)}>
            <BarChart data={analytics?.headcount_by_location || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="location" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Employees" fill={EXEC_CHART_COLORS[6]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => drill(`Location — ${d.location}`, r => r.location === d.location,
                  ['name', 'designation', 'function', 'project_name', 'billing', 'location'])} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Effort Utilization" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.effort_buckets || []}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Resources" fill={EXEC_CHART_COLORS[1]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => drill(`Effort — ${d.bucket}`, r => execGetEffortBucket(r.efforts_pct) === d.bucket)} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Billability Distribution" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.billability_buckets || []}>
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Resources" fill={EXEC_CHART_COLORS[7]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => drill(`Billability — ${d.bucket}`, r => execGetBillabilityBucket(r.billability_pct) === d.bucket)} />
            </BarChart>
          </ResponsiveContainer>
        </ExecChartCard>

        <ExecChartCard title="Full Allocation Table" full>
          <div className="ab-search-row">
            <input
              className="ab-search"
              placeholder="Search by name, project, or function..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span className="ab-count">{filtered.length} records</span>
          </div>
          <div className="ab-table-wrap ab-table-scroll">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Function</th><th>Project</th>
                  <th>Status</th><th>Billing</th><th>Delivery Mgr</th>
                  <th>Effort %</th><th>Billability %</th><th>Completion</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={i} className="ab-tr-click" onClick={() => onEmployeeClick(r.employee_id)}>
                    <td>{execFmt(r.name)}</td>
                    <td>{execFmt(r.function)}</td>
                    <td>{execFmt(r.project_name)}</td>
                    <td>
                      <span className={`ab-badge ab-badge--${(r.project_status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        {execFmt(r.project_status)}
                      </span>
                    </td>
                    <td>{execFmt(r.billing)}</td>
                    <td>{execFmt(r.delivery_manager)}</td>
                    <td>{execFmt(r.efforts_pct)}</td>
                    <td>{execFmt(r.billability_pct)}</td>
                    <td>{execFmt(r.completion_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ExecChartCard>
      </div>

      <ExecDrillModal
        drill={drillDown}
        onClose={() => setDrillDown(null)}
        onRowClick={r => r.employee_id ? (setDrillDown(null), onEmployeeClick(r.employee_id)) : null}
      />
    </div>
  );
}

const EXEC_AURA_HINTS = [
  'Which employees are on No Allocation?',
  'Show all billable resources',
  'Who has less than 50% effort across the org?',
  'List all projects and their headcount',
  'Which functions have the most available capacity?',
];

function ExecAskAuraPanel({ onClose }) {
  const [messages, setMessages] = useState([{ role: 'assistant', text: "Hi! I'm Aura." }]);
  const [input,   setInput]   = useState('');
  const [busy,    setBusy]    = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || busy) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await askAllocationAura(q);
      setMessages(prev => [...prev, { role: 'assistant', text: res.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}`, error: true }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy]);

  const onKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  return (
    <>
      <div className="ab-aura-overlay" onClick={onClose} />
      <div className="ab-aura-panel">
        <div className="ab-aura-header">
          <div className="ab-aura-header-left">
            <div className="ab-aura-icon"><i className="fas fa-robot" /></div>
            <div>
              <div className="ab-aura-title">Ask Aura</div>
              <div className="ab-aura-subtitle">Allocation assistant</div>
            </div>
          </div>
          <button className="ab-detail-close" onClick={onClose}>✕</button>
        </div>
        <div className="ab-aura-messages">
          {messages.map((m, i) => (
            <div key={i} className={`ab-aura-msg ab-aura-msg--${m.role}${m.error ? ' ab-aura-msg--error' : ''}`}>
              {m.role === 'assistant' && <div className="ab-aura-msg-avatar"><i className="fas fa-robot" /></div>}
              <div className="ab-aura-msg-bubble">{m.text}</div>
            </div>
          ))}
          {busy && (
            <div className="ab-aura-msg ab-aura-msg--assistant">
              <div className="ab-aura-msg-avatar"><i className="fas fa-robot" /></div>
              <div className="ab-aura-msg-bubble ab-aura-typing"><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length === 1 && !busy && (
          <div className="ab-aura-hints">
            {EXEC_AURA_HINTS.map((h, i) => (
              <button key={i} className="ab-aura-hint-btn" onClick={() => send(h)}>{h}</button>
            ))}
          </div>
        )}
        <div className="ab-aura-input-row">
          <textarea
            ref={inputRef}
            className="ab-aura-input"
            placeholder="Ask about your team, projects, availability..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={busy}
          />
          <button className="ab-aura-send" onClick={() => send()} disabled={!input.trim() || busy}>
            <i className="fas fa-paper-plane" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Default export: COO Dashboard now renders Executive View with allocation board data ──
export default function COODashboard() {
  const [boardData,     setBoardData]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [drawerEmp,     setDrawerEmp]     = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [auraOpen,      setAuraOpen]      = useState(false);

  useEffect(() => {
    getAllocationBoard()
      .then(setBoardData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleEmployeeClick = useCallback(async (employeeId) => {
    if (!employeeId) return;
    setDrawerLoading(true);
    setDrawerEmp(null);
    try {
      const detail = await getEmployeeDetail(employeeId);
      setDrawerEmp(detail);
    } catch (e) {
      console.error('Failed to load employee detail:', e);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerEmp(null);
    setDrawerLoading(false);
  }, []);

  if (loading) return (
    <div className="ab-state-center">
      <div className="ab-spinner" />
      <p>Loading Allocation Board…</p>
    </div>
  );

  if (error) return (
    <div className="ab-state-center ab-state-error">
      <i className="fa fa-exclamation-triangle" />
      <p>Failed to load: {error}</p>
    </div>
  );

  if (!boardData) return null;

  return (
    <div className="ab-root">
      <div className="ab-header">
        <div>
          <h2 className="ab-title">Allocation <span>Board</span></h2>
          <div className="ab-header-meta">
            <span className="ab-role-badge">Executive</span>
          </div>
        </div>
        <button className="ab-ask-aura-btn" onClick={() => setAuraOpen(true)}>
          <i className="fas fa-robot" />
          Ask Aura
        </button>
      </div>
      {auraOpen && <ExecAskAuraPanel onClose={() => setAuraOpen(false)} />}
      <ExecEmpDrawer emp={drawerEmp} loading={drawerLoading} onClose={closeDrawer} />
      <ExecutiveView data={boardData} onEmployeeClick={handleEmployeeClick} />
    </div>
  );
}
