import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from 'recharts';
import { getSkillsAnalytics } from '../services/skillApi';

// ── Muted brand palette — visible but not glaring on dark/light backgrounds ───
const COLORS = [
  '#4a8fc4', // muted aligned blue
  '#3da8c8', // muted light blue
  '#52a865', // muted green
  '#5762a8', // muted deep blue
  '#c49b3d', // muted amber
  '#b86060', // muted rose
  '#7f72c4', // muted purple
  '#3d9e82', // muted teal
  '#c4794d', // muted orange
  '#3d8ea8', // muted cyan
];
const getColor = (i) => COLORS[i % COLORS.length];

// ── Helpers ───────────────────────────────────────────────────────────────────
function skillList(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub }) {
  return (
    <div className="sh-stat-card">
      <div className="sh-stat-icon" style={{ background: `${color}1a`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="sh-stat-body">
        <div className="sh-stat-value">{value}</div>
        <div className="sh-stat-label">{label}</div>
        {sub && <div className="sh-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="sh-tooltip">
      <div className="sh-tooltip-label">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="sh-tooltip-row">
          <span className="sh-tooltip-dot" style={{ background: p.color || p.fill }} />
          <span>{p.value} {p.value === 1 ? 'employee' : 'employees'}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="sh-tooltip">
      <div className="sh-tooltip-label">{name}</div>
      <div className="sh-tooltip-row"><span>{value} employees</span></div>
    </div>
  );
}

// ── Skill tag chip ────────────────────────────────────────────────────────────
function SkillTag({ skill, active, onClick }) {
  return (
    <span
      className={`sh-skill-tag${active ? ' sh-skill-tag--active' : ''}`}
      onClick={onClick}
      title={`Filter by ${skill}`}
    >
      {skill}
    </span>
  );
}

// ── Top Skills horizontal bar chart ──────────────────────────────────────────
function TopSkillsChart({ skills }) {
  const data = skills.slice(0, 15).map(s => ({ skill: s.skill, count: s.count }));
  return (
    <ResponsiveContainer width="100%" height={290}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 20, top: 2, bottom: 2 }}>
        <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category" dataKey="skill" width={110}
          tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
          axisLine={false} tickLine={false}
        />
        <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(74,143,196,0.07)' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={14}>
          {data.map((_, i) => <Cell key={i} fill={getColor(i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Skills by Function column bar ─────────────────────────────────────────────
function SkillsByFunctionChart({ byFunction }) {
  const data = byFunction.slice(0, 10).map(f => ({
    name: f.function.length > 16 ? f.function.slice(0, 14) + '…' : f.function,
    fullName: f.function,
    headcount: f.headcount,
  }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 2, bottom: 36 }}>
        <XAxis
          dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
          axisLine={false} tickLine={false}
          angle={-30} textAnchor="end" interval={0}
        />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const item = data.find(d => d.name === label);
            return (
              <div className="sh-tooltip">
                <div className="sh-tooltip-label">{item?.fullName || label}</div>
                <div className="sh-tooltip-row">
                  <span className="sh-tooltip-dot" style={{ background: '#4a8fc4' }} />
                  <span>{payload[0].value} employees</span>
                </div>
              </div>
            );
          }}
          cursor={{ fill: 'rgba(74,143,196,0.07)' }}
        />
        <Bar dataKey="headcount" radius={[3, 3, 0, 0]} maxBarSize={30}>
          {data.map((_, i) => <Cell key={i} fill={getColor(i)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Skill distribution pie chart ──────────────────────────────────────────────
function SkillPieChart({ byFunction }) {
  const data = byFunction.slice(0, 8).map((f, i) => ({
    name: f.function,
    value: f.headcount,
    color: getColor(i),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data} dataKey="value" nameKey="name"
          cx="50%" cy="48%" innerRadius={44} outerRadius={80}
          paddingAngle={2}
        >
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)', paddingTop: 4 }}
          iconSize={8} iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Radar chart for top-skill profile across experience groups ────────────────
function ExperienceRadarChart({ byExpGroup, topSkills }) {
  const TOP_N = 6;
  const topSkillNames = topSkills.slice(0, TOP_N).map(s => s.skill);

  const radarData = topSkillNames.map(skill => {
    const entry = { skill };
    byExpGroup.forEach(grp => {
      const found = grp.top_skills.find(s => s.skill === skill);
      entry[grp.exp_group] = found ? found.count : 0;
    });
    return entry;
  });

  const groups = byExpGroup.slice(0, 4);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
        {groups.map((grp, i) => (
          <Radar
            key={grp.exp_group}
            name={grp.exp_group}
            dataKey={grp.exp_group}
            stroke={getColor(i)}
            fill={getColor(i)}
            fillOpacity={0.12}
          />
        ))}
        <Legend
          wrapperStyle={{ fontSize: 10, color: 'var(--text-secondary)', paddingTop: 2 }}
          iconSize={8} iconType="circle"
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="sh-tooltip">
                <div className="sh-tooltip-label">{label}</div>
                {payload.map((p, i) => (
                  <div key={i} className="sh-tooltip-row">
                    <span className="sh-tooltip-dot" style={{ background: p.stroke }} />
                    <span>{p.name}: {p.value}</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Employee table ────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

function EmployeeTable({ employees, activeSkill, onSkillClick }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const slice = employees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [employees.length]);

  if (!employees.length) {
    return (
      <div className="sh-empty">
        <i className="fas fa-search sh-empty-icon" />
        <div>No employees match the current filters.</div>
      </div>
    );
  }

  return (
    <div className="sh-table-wrap">
      <table className="sh-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Designation</th>
            <th>Function</th>
            <th>Experience</th>
            <th>Location</th>
            <th>Skills</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((emp) => (
            <tr key={emp.employee_id || emp.name}>
              <td><div className="sh-emp-name">{emp.name || '—'}</div></td>
              <td><span className="sh-desg-badge">{emp.designation || '—'}</span></td>
              <td>{emp.function || '—'}</td>
              <td>{emp.exp_group || '—'}</td>
              <td>{emp.location || '—'}</td>
              <td>
                <div className="sh-tag-list">
                  {skillList(emp.primary_skills).map(skill => (
                    <SkillTag
                      key={skill}
                      skill={skill}
                      active={activeSkill === skill}
                      onClick={() => onSkillClick(skill)}
                    />
                  ))}
                  {!emp.primary_skills && <span className="sh-no-skills">—</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="sh-pagination">
          <button className="sh-page-btn" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
            <i className="fas fa-chevron-left" />
          </button>
          <span className="sh-page-info">
            Page {safePage} of {totalPages}
            <span className="sh-page-count"> ({employees.length} employees)</span>
          </span>
          <button className="sh-page-btn" disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
function FilterBar({ options, filters, onChange, onReset }) {
  const hasActive = Object.values(filters).some(Boolean);
  return (
    <div className="sh-filter-bar">
      <select className="sh-select" value={filters.function} onChange={e => onChange('function', e.target.value)}>
        <option value="">All Functions</option>
        {options.functions.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select className="sh-select" value={filters.exp_group} onChange={e => onChange('exp_group', e.target.value)}>
        <option value="">All Experience</option>
        {options.exp_groups.map(g => <option key={g} value={g}>{g}</option>)}
      </select>
      <select className="sh-select" value={filters.location} onChange={e => onChange('location', e.target.value)}>
        <option value="">All Locations</option>
        {options.locations.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      {hasActive && (
        <button className="sh-reset-btn" onClick={onReset}>
          <i className="fas fa-xmark" /> Clear
        </button>
      )}
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="sh-skeleton-wrap">
      <div className="sh-skeleton sh-skeleton--stats" />
      <div className="sh-skeleton-row">
        <div className="sh-skeleton sh-skeleton--chart" />
        <div className="sh-skeleton sh-skeleton--chart" />
      </div>
      <div className="sh-skeleton sh-skeleton--table" />
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function SkillRadarDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const [search,      setSearch]      = useState('');
  const [activeSkill, setActiveSkill] = useState('');
  const [filters,     setFilters]     = useState({ function: '', exp_group: '', location: '' });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSkillsAnalytics();
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load skill data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filters and search are independent AND conditions — clicking a skill tag
  // does NOT clear the search box, and typing does NOT clear the skill filter.
  const handleFilterChange = (key, val) => setFilters(prev => ({ ...prev, [key]: val }));

  const handleSkillClick = (skill) => {
    setActiveSkill(prev => (prev === skill ? '' : skill));
  };

  const resetAll = () => {
    setFilters({ function: '', exp_group: '', location: '' });
    setSearch('');
    setActiveSkill('');
  };

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    let list = data.employees;

    if (filters.function)  list = list.filter(e => e.function  === filters.function);
    if (filters.exp_group) list = list.filter(e => e.exp_group === filters.exp_group);
    if (filters.location)  list = list.filter(e => e.location  === filters.location);

    if (activeSkill) {
      const aq = activeSkill.toLowerCase();
      list = list.filter(e => skillList(e.primary_skills).some(s => s.toLowerCase() === aq));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        skillList(e.primary_skills).some(s => s.toLowerCase().includes(q)) ||
        (e.designation || '').toLowerCase().includes(q) ||
        (e.function || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [data, filters, activeSkill, search]);

  const hasAnyFilter = search.trim() || activeSkill || Object.values(filters).some(Boolean);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className="sh-root">
        <div className="sh-error-state">
          <i className="fas fa-triangle-exclamation sh-error-icon" />
          <div className="sh-error-title">Failed to load Skill Radar</div>
          <div className="sh-error-msg">{error}</div>
          <button className="sh-retry-btn" onClick={load}>
            <i className="fas fa-rotate-right" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, top_skills, skills_by_function, skills_by_exp_group, filter_options } = data;

  return (
    <div className="sh-root">
      {/* ── Header ── */}
      <div className="sh-header">
        <div className="sh-header-left">
          <div className="sh-header-icon">
            <i className="fas fa-brain" />
          </div>
          <div>
            <h1 className="sh-title">Skill Radar</h1>
            <p className="sh-subtitle">Org-wide skill intelligence from employee profiles</p>
          </div>
        </div>

        <div className="sh-search-wrap">
          <i className="fas fa-magnifying-glass sh-search-icon" />
          <input
            className="sh-search"
            placeholder="Search by name, skill, or designation…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="sh-search-clear" onClick={() => setSearch('')}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="sh-stats-row">
        <StatCard icon="fa-users"     label="Total Employees"       value={summary.total_employees}         color="#4a8fc4" />
        <StatCard icon="fa-lightbulb" label="Unique Skills"         value={summary.total_unique_skills}     color="#3da8c8" />
        <StatCard icon="fa-chart-bar" label="Avg Skills / Employee" value={summary.avg_skills_per_employee} color="#52a865" />
        <StatCard icon="fa-star"      label="Most Common Skill"     value={summary.most_popular_skill}      color="#c49b3d" sub="top skill" />
      </div>

      {/* ── Filter Bar ── */}
      <div className="sh-filter-row">
        <FilterBar options={filter_options} filters={filters} onChange={handleFilterChange} onReset={() => setFilters({ function: '', exp_group: '', location: '' })} />
        {hasAnyFilter && (
          <button className="sh-reset-all-btn" onClick={resetAll}>
            <i className="fas fa-rotate-left" /> Reset all
          </button>
        )}
      </div>

      {/* ── Active filters summary ── */}
      {(activeSkill || search.trim()) && (
        <div className="sh-filter-pills">
          {activeSkill && (
            <span className="sh-filter-pill">
              <i className="fas fa-tag" /> {activeSkill}
              <button onClick={() => setActiveSkill('')}><i className="fas fa-xmark" /></button>
            </span>
          )}
          {search.trim() && (
            <span className="sh-filter-pill sh-filter-pill--search">
              <i className="fas fa-magnifying-glass" /> "{search}"
              <button onClick={() => setSearch('')}><i className="fas fa-xmark" /></button>
            </span>
          )}
          <span className="sh-filter-result-count">{filteredEmployees.length} result{filteredEmployees.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Charts row 1: Top Skills + Pie ── */}
      <div className="sh-charts-row">
        <div className="sh-card sh-card--wide">
          <div className="sh-card-header">
            <div className="sh-card-title"><i className="fas fa-ranking-star" /> Top Skills in AA</div>
            <span className="sh-card-badge">Top 15</span>
          </div>
          <TopSkillsChart skills={top_skills} />
        </div>

        <div className="sh-card">
          <div className="sh-card-header">
            <div className="sh-card-title"><i className="fas fa-chart-pie" /> Headcount by Function</div>
          </div>
          <SkillPieChart byFunction={skills_by_function} />
        </div>
      </div>

      {/* ── Charts row 2: By Function Bar + Radar ── */}
      <div className="sh-charts-row">
        <div className="sh-card sh-card--wide">
          <div className="sh-card-header">
            <div className="sh-card-title"><i className="fas fa-layer-group" /> Employees per Function</div>
          </div>
          <SkillsByFunctionChart byFunction={skills_by_function} />
        </div>

        <div className="sh-card">
          <div className="sh-card-header">
            <div className="sh-card-title"><i className="fas fa-hexagon-nodes" /> Skill Profile by Experience</div>
            <span className="sh-card-badge">Top 6</span>
          </div>
          <ExperienceRadarChart byExpGroup={skills_by_exp_group} topSkills={top_skills} />
        </div>
      </div>

      {/* ── Trending Skills grid ── */}
      <div className="sh-card sh-card--full">
        <div className="sh-card-header">
          <div className="sh-card-title"><i className="fas fa-fire" /> Trending Skills</div>
          <span className="sh-card-sub">Click to filter the employee table below</span>
        </div>
        <div className="sh-trending-grid">
          {top_skills.slice(0, 18).map((s, i) => (
            <div
              key={s.skill}
              className={`sh-trending-item${activeSkill === s.skill ? ' sh-trending-item--active' : ''}`}
              onClick={() => handleSkillClick(s.skill)}
            >
              <span className="sh-trending-rank" style={{ color: getColor(i) }}>#{i + 1}</span>
              <span className="sh-trending-name">{s.skill}</span>
              <span className="sh-trending-count">{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Employee Table ── */}
      <div className="sh-card sh-card--full">
        <div className="sh-card-header">
          <div className="sh-card-title"><i className="fas fa-table-list" /> Employee Skills Directory</div>
          <span className="sh-card-badge">{filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}</span>
        </div>
        <EmployeeTable
          employees={filteredEmployees}
          activeSkill={activeSkill}
          onSkillClick={handleSkillClick}
        />
      </div>
    </div>
  );
}
