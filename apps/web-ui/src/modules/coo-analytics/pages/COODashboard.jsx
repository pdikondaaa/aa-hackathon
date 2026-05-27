import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
  ScatterChart, Scatter, ZAxis,
  Treemap,
} from 'recharts';
import { cooAnalyticsApi } from '../services/cooAnalyticsApi';

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

function ChartCard({ title, subtitle, children, style = {} }) {
  return (
    <div style={{ ...s.card, ...style }}>
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardTitle}>{title}</div>
          {subtitle && <div style={s.cardSub}>{subtitle}</div>}
        </div>
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

function FilterBar({ options, filters, onChange }) {
  const sel = (key) => (
    <select
      value={filters[key] || ''}
      onChange={e => onChange({ ...filters, [key]: e.target.value || undefined })}
      style={{
        padding: '6px 10px', fontSize: 12, borderRadius: 7,
        background: 'var(--bg-elevated)', color: 'var(--text)',
        border: '1px solid var(--border)', cursor: 'pointer',
      }}
    >
      <option value="">All</option>
      {(options[key] || []).map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  );

  return (
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.8px', marginRight: 4 }}>FILTERS</span>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>Function {sel('functions')}</label>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>Sub-Function {sel('subfunctions')}</label>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>Client {sel('clients')}</label>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>Project Status {sel('project_statuses')}</label>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>Delivery Manager {sel('delivery_managers')}</label>
      {Object.values(filters).some(Boolean) && (
        <button onClick={() => onChange({})} style={{ ...s.btn, background: C.red + '15', borderColor: C.red + '40', color: C.red, marginLeft: 'auto' }}>
          <i className="fas fa-xmark" /> Clear
        </button>
      )}
    </div>
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

// ── Main dashboard ─────────────────────────────────────────────────────────────
export default function COODashboard() {
  const [data,          setData]          = useState(null);
  const [filterOptions, setFilterOptions] = useState({});
  const [filters,       setFilters]       = useState({});
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);

  const load = useCallback(async (activeFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const apiFilters = {
        function:         activeFilters.functions,
        subfunction:      activeFilters.subfunctions,
        client:           activeFilters.clients,
        project_status:   activeFilters.project_statuses,
        delivery_manager: activeFilters.delivery_managers,
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
    load(filters);
    cooAnalyticsApi.getFilterOptions()
      .then(setFilterOptions)
      .catch(() => {});
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
      <div style={s.header}>
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
          <button
            onClick={() => load(filters)}
            style={{ ...s.btn, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            disabled={loading}
          >
            <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* ── Filters ─────────────────────────────────────────── */}
        <FilterBar options={filterOptions} filters={filters} onChange={handleFilterChange} />

        {loading && !data ? <LoadingSkeleton /> : (
          <>
            {/* ── KPI Strip ───────────────────────────────────────── */}
            <SectionHeader icon="fa-square-poll-vertical" title="KEY PERFORMANCE INDICATORS" color={C.primary} />
            <div style={{ ...s.kpiGrid, marginBottom: 24 }}>
              <KPICard label="Billable Employees"        value={kpis.total_billable_employees ?? '—'}     unit=""  icon="fa-users"          color={C.primary}   sub="On active billable projects" />
              <KPICard label="Avg Effort Allocation"     value={kpis.avg_efforts_pct ?? '—'}              unit="%" icon="fa-bullseye"        color={C.lightBlue} sub="Billable workforce avg" />
              <KPICard label="Avg Billability Rate"      value={kpis.avg_billability_pct ?? '—'}          unit="%" icon="fa-sack-dollar"     color={C.green}     sub="Against client commitment" />
              <KPICard label="Fully Allocated"           value={kpis.fully_allocated_employees ?? '—'}    unit=""  icon="fa-circle-check"    color={C.green}     sub={`${fullyAllocPct}% of billable team`} />
              <KPICard label="Overallocated"             value={kpis.overallocated_employees ?? '—'}      unit=""  icon="fa-person-running"  color={C.red}       sub={`${overPct}% — delivery risk`} />
              <KPICard label="Underallocated"            value={kpis.underallocated_employees ?? '—'}     unit=""  icon="fa-user-clock"      color={C.amber}     sub="Unused billable capacity" />
              <KPICard label="Active Clients"            value={kpis.active_clients ?? '—'}               unit=""  icon="fa-building"        color={C.deepBlue}  sub="Billable client accounts" />
              <KPICard label="Active Billable Projects"  value={kpis.active_projects ?? '—'}              unit=""  icon="fa-diagram-project" color={C.purple}    sub="Ongoing engagements" />
              <KPICard label="Operational Efficiency"    value={kpis.operational_efficiency_score ?? '—'} unit="%" icon="fa-gear"            color={C.teal}      sub="Effort + billability avg" />
            </div>

            {/* ── Section 1: Delivery Health ───────────────────────── */}
            <SectionHeader icon="fa-heart-pulse" title="SECTION 1 — COMPANY DELIVERY HEALTH" color={C.green} />
            <div style={{ ...s.grid2, marginBottom: 24 }}>

              {/* Chart 1: Allocation Distribution */}
              <ChartCard title="Workforce Allocation Distribution" subtitle="Fully / Under / Over / Without allocation">
                {(data?.allocation_distribution || []).every(d => d.value === 0) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={data?.allocation_distribution || []}
                        cx="50%" cy="50%"
                        innerRadius={60} outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
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

              {/* Chart 2: Allocation Trend */}
              <ChartCard title="Allocation Trend Over Time" subtitle="Monthly avg effort & billability %">
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

            {/* ── Section 2: Customer & Revenue Capacity ───────────── */}
            <SectionHeader icon="fa-building-columns" title="SECTION 2 — CUSTOMER & REVENUE CAPACITY" color={C.lightBlue} />
            <div style={{ ...s.grid2, marginBottom: 16 }}>

              {/* Chart 3: Client Contribution */}
              <ChartCard title="Top Client Contribution" subtitle="Headcount & avg billability by client">
                {!(data?.client_contribution?.length) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.client_contribution.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis dataKey="client_master" type="category" width={90} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v, name === 'headcount' ? 'Resources' : 'Avg Billability %']}
                      />
                      <Bar dataKey="headcount" name="Resources" fill={C.primary} radius={[0, 4, 4, 0]} barSize={12}>
                        <LabelList dataKey="headcount" position="right" style={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              {/* Top Billable Projects */}
              <ChartCard title="Top Billable Projects by Headcount" subtitle="Resource count per active billable project">
                {!(data?.top_projects?.length) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.top_projects.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 36, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <YAxis dataKey="project_name" type="category" width={100} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                      <Tooltip
                        contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [v, name === 'headcount' ? 'Resources' : name]}
                        labelFormatter={label => <span style={{ fontWeight: 600 }}>{label}</span>}
                      />
                      <Bar dataKey="headcount" name="Resources" radius={[0, 4, 4, 0]} barSize={12}>
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

            {/* Chart 4: Client Concentration Risk — Treemap */}
            <ChartCard
              title="Client Concentration Risk"
              subtitle="Share of billable workforce per client — larger tile = higher dependency"
              style={{ marginBottom: 24 }}
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

            {/* ── Section 3: Business Unit Performance ─────────────── */}
            <SectionHeader icon="fa-sitemap" title="SECTION 3 — BUSINESS UNIT PERFORMANCE" color={C.deepBlue} />
            <div style={{ ...s.grid2, marginBottom: 24 }}>

              {/* Chart 6: Function Efficiency Heatmap */}
              <ChartCard title="Function × Sub-Function Efficiency" subtitle="Avg effort %, avg billability %, headcount">
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
                          <tr key={i} style={{ background: 'var(--bg-elevated)', borderRadius: 6 }}>
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

              {/* Chart 7: Delivery Load Scatter */}
              <ChartCard title="Delivery Load Distribution" subtitle="Effort vs billability — bubble size = headcount">
                {!(data?.delivery_load?.length) ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={320}>
                    <ScatterChart margin={{ top: 20, right: 20, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="avg_efforts"     name="Effort %"      type="number" domain={[0, 120]} unit="%" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Avg Effort %', position: 'insideBottom', offset: -5, fontSize: 10, fill: 'var(--text-muted)' }} />
                      <YAxis dataKey="avg_billability" name="Billability %" type="number" domain={[0, 120]} unit="%" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} label={{ value: 'Avg Billability %', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: 'var(--text-muted)' }} />
                      <ZAxis dataKey="headcount" range={[40, 500]} name="Headcount" />
                      <Tooltip content={<CustomScatterTooltip />} />
                      <Scatter
                        data={data.delivery_load}
                        fill={C.primary}
                        fillOpacity={0.75}
                      >
                        {data.delivery_load.map((d, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
                {data?.delivery_load?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {data.delivery_load.slice(0, 8).map((d, i) => (
                      <span key={i} style={{ ...s.tag, background: CHART_COLORS[i % CHART_COLORS.length] + '18', color: CHART_COLORS[i % CHART_COLORS.length], border: `1px solid ${CHART_COLORS[i % CHART_COLORS.length]}30`, fontSize: 10 }}>
                        <i className="fas fa-circle" style={{ fontSize: 6 }} /> {d.function}
                      </span>
                    ))}
                  </div>
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
