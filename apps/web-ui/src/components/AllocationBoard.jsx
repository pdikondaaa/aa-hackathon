import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { getAllocationBoard, getEmployeeDetail, askAllocationAura } from '../services/api';

const CHART_COLORS = ['#1D76BC', '#27AAE1', '#4ED44E', '#2A3D90', '#f59e0b', '#ef4444', '#a78bfa', '#10b981'];
const BILLING_EXCLUDE_EXEC = ['Pipeline', 'Sales'];

function fmt(val) {
  if (val === null || val === undefined || val === '') return '—';
  return val;
}

function fmtDate(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString(); } catch { return val; }
}

function getBillabilityBucket(pct) {
  if (pct === null || pct === undefined) return 'Unknown';
  if (pct === 0) return '0%';
  if (pct < 50) return '1-49%';
  if (pct < 100) return '50-99%';
  return '100%';
}

function nameMatch(field, userName) {
  if (!field || !userName) return false;
  const f = field.trim().toLowerCase();
  const u = userName.trim().toLowerCase();
  return f.includes(u) || u.includes(f);
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ChartCard({ title, children, wide, full, hint }) {
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

// ── Right-side employee drawer ────────────────────────────────────────────────

function EmpDrawer({ emp, loading, onClose }) {
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
                <span className="ab-desig-text">{fmt(emp?.designation)}</span>
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
                      <span>{fmt(val)}</span>
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
                    ['Alloc. Date', emp?.allocation_date ? fmtDate(emp.allocation_date) : null],
                  ].map(([label, val]) => (
                    <div key={label} className="ab-drawer-row">
                      <span className="ab-label">{label}</span>
                      <span>{fmt(val)}</span>
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

// ── Generic drill-down modal ──────────────────────────────────────────────────

function DrillModal({ drill, onClose, onRowClick }) {
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
                            : fmt(r[c])}
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

// ── Executive view ────────────────────────────────────────────────────────────

function ExecutiveView({ data, onEmployeeClick }) {
  const { analytics, allocation_rows } = data;
  const [search, setSearch] = useState('');
  const [drillDown, setDrillDown] = useState(null);

  const billingData = useMemo(() =>
    (analytics?.billing_breakdown || []).filter(r => !BILLING_EXCLUDE_EXEC.includes(r.billing)),
    [analytics]
  );

  const filtered = useMemo(() => (allocation_rows || []).filter(r =>
    !search ||
    (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.project_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.function || '').toLowerCase().includes(search.toLowerCase())
  ), [allocation_rows, search]);

  const handleDrill = useCallback((type, value) => {
    const rows = allocation_rows || [];
    let filtered, title, columns;
    const colLabels = {
      name: 'Name', project_name: 'Project', sub_project: 'Sub-Project',
      project_status: 'Status', billing: 'Billing', function: 'Function',
      designation: 'Designation', delivery_manager: 'Delivery Mgr',
      efforts_pct: 'Effort %', billability_pct: 'Billability %',
    };
    if (type === 'billing') {
      filtered = rows.filter(r => r.billing === value);
      title = `Billing — ${value}`;
      columns = ['name', 'project_name', 'sub_project', 'project_status', 'function'];
    } else if (type === 'function') {
      filtered = rows.filter(r => r.function === value);
      title = `Function — ${value}`;
      columns = ['name', 'designation', 'project_name', 'project_status', 'billing'];
    }
    setDrillDown({ title, columns, colLabels, rows: filtered || [] });
  }, [allocation_rows]);

  return (
    <div className="ab-analytics">
      <div className="ab-charts-grid">
        <ChartCard title="Billable vs Internal Projects" hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={billingData}>
              <XAxis dataKey="billing" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="project_count" name="Projects" fill={CHART_COLORS[0]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => handleDrill('billing', d.billing)} />
              <Bar dataKey="resource_count" name="Resources" fill={CHART_COLORS[1]} radius={[4,4,0,0]} cursor="pointer"
                onClick={d => handleDrill('billing', d.billing)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Headcount by Function" wide hint="Click bar to explore">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics?.function_headcount || []} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="function" type="category" width={180} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="headcount" fill={CHART_COLORS[2]} radius={[0,4,4,0]} cursor="pointer"
                onClick={d => handleDrill('function', d.function)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Full Allocation Table" full>
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
                    <td>{fmt(r.name)}</td>
                    <td>{fmt(r.function)}</td>
                    <td>{fmt(r.project_name)}</td>
                    <td>
                      <span className={`ab-badge ab-badge--${(r.project_status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                        {fmt(r.project_status)}
                      </span>
                    </td>
                    <td>{fmt(r.billing)}</td>
                    <td>{fmt(r.delivery_manager)}</td>
                    <td>{fmt(r.efforts_pct)}</td>
                    <td>{fmt(r.billability_pct)}</td>
                    <td>{fmt(r.completion_status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <DrillModal
        drill={drillDown}
        onClose={() => setDrillDown(null)}
        onRowClick={r => { setDrillDown(null); onEmployeeClick(r.employee_id); }}
      />
    </div>
  );
}

// ── Functional Lead / Business Lead view ──────────────────────────────────────

function LeadView({ data, onEmployeeClick, role }) {
  const { allocation_rows, user_name } = data;
  const [teamModal, setTeamModal]       = useState(null);
  const [projectModal, setProjectModal] = useState(null);

  const myTeam = useMemo(() =>
    (allocation_rows || []).filter(r => nameMatch(r.functional_manager, user_name)),
    [allocation_rows, user_name]
  );

  const reportees = useMemo(() =>
    (allocation_rows || []).filter(r => nameMatch(r.reporting_manager, user_name)),
    [allocation_rows, user_name]
  );

  const availablePool = useMemo(() =>
    myTeam.filter(r => r.efforts_pct == null || r.efforts_pct < 100),
    [myTeam]
  );

  const billableResources = useMemo(() =>
    myTeam.filter(r => (r.billing || '').toLowerCase() === 'billable'),
    [myTeam]
  );

  const myProjects = useMemo(() => {
    if (role !== 'business_lead') return [];
    const projectMap = {};
    for (const r of (allocation_rows || [])) {
      if (nameMatch(r.project_lead, user_name) || nameMatch(r.delivery_manager, user_name)) {
        const pname = r.project_name || 'Unknown';
        if (!projectMap[pname]) projectMap[pname] = { project_name: pname, resources: [] };
        projectMap[pname].resources.push(r);
      }
    }
    return Object.values(projectMap).sort((a, b) => b.resources.length - a.resources.length);
  }, [allocation_rows, user_name, role]);

  const COL_LABELS = {
    name: 'Name', designation: 'Designation', function: 'Function',
    project_name: 'Project', billing: 'Billing', efforts_pct: 'Effort %',
    billability_pct: 'Billability %', project_status: 'Status',
  };

  return (
    <div className="ab-lead-view">

      {/* Summary cards */}
      <div className="ab-lead-cards">
        <div
          className="ab-lead-card ab-lead-card--clickable"
          onClick={() => setTeamModal({
            title: 'My Team (Functional)',
            rows: myTeam,
            columns: ['name', 'designation', 'function', 'project_name', 'billing', 'efforts_pct', 'billability_pct'],
            colLabels: COL_LABELS,
          })}
        >
          <div className="ab-lead-card-value">{myTeam.length}</div>
          <div className="ab-lead-card-label">Team Members</div>
          <div className="ab-lead-card-sub">Click for details</div>
        </div>

        <div
          className="ab-lead-card ab-lead-card--clickable"
          onClick={() => setTeamModal({
            title: 'Direct Reportees',
            rows: reportees,
            columns: ['name', 'designation', 'function', 'project_name', 'billing', 'efforts_pct', 'billability_pct'],
            colLabels: COL_LABELS,
          })}
        >
          <div className="ab-lead-card-value">{reportees.length}</div>
          <div className="ab-lead-card-label">Direct Reportees</div>
          <div className="ab-lead-card-sub">Click for details</div>
        </div>

        <div className="ab-lead-card">
          <div className="ab-lead-card-value">{availablePool.length}</div>
          <div className="ab-lead-card-label">Available</div>
        </div>

        <div className="ab-lead-card">
          <div className="ab-lead-card-value">{billableResources.length}</div>
          <div className="ab-lead-card-label">Billable</div>
        </div>
      </div>

      {/* Reportees tree */}
      <div className="ab-lead-section">
        <div className="ab-section-label">Reportees ({reportees.length})</div>
        {reportees.length === 0 ? (
          <p className="ab-empty">No direct reportees found under your name.</p>
        ) : (
          <div className="ab-reportee-tree">
            {reportees.map((r, i) => (
              <div key={i} className="ab-reportee-node" onClick={() => onEmployeeClick(r.employee_id)}>
                <div className="ab-reportee-avatar">{(r.name || '?')[0].toUpperCase()}</div>
                <div className="ab-reportee-info">
                  <div className="ab-reportee-name">{r.name}</div>
                  <div className="ab-reportee-meta">
                    <span>{fmt(r.designation)}</span>
                    {r.function && <span className="ab-reportee-fn">{r.function}</span>}
                  </div>
                  {r.project_name && (
                    <div className="ab-reportee-project">{r.project_name}</div>
                  )}
                  <div className="ab-reportee-tags">
                    {r.billing && <span className="ab-tag">{r.billing}</span>}
                    {r.efforts_pct != null && <span className="ab-tag ab-tag--effort">Effort: {r.efforts_pct}%</span>}
                    {(r.billing || '').toLowerCase() === 'billable' && r.billability_pct != null && (
                      <span className="ab-tag ab-tag--bill">Bill: {r.billability_pct}%</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Resource Pool */}
      <div className="ab-lead-section">
        <div className="ab-section-label">Available Resource Pool ({availablePool.length})</div>
        {availablePool.length === 0 ? (
          <p className="ab-empty">No resources with available capacity.</p>
        ) : (
          <div className="ab-table-wrap ab-table-scroll">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Name</th><th>Designation</th><th>Function</th>
                  <th>Project</th><th>Effort %</th><th>Available %</th><th>Billability %</th>
                </tr>
              </thead>
              <tbody>
                {availablePool.map((r, i) => (
                  <tr key={i} className="ab-tr-click" onClick={() => onEmployeeClick(r.employee_id)}>
                    <td>{fmt(r.name)}</td>
                    <td>{fmt(r.designation)}</td>
                    <td>{fmt(r.function)}</td>
                    <td>{fmt(r.project_name)}</td>
                    <td>{r.efforts_pct != null ? `${r.efforts_pct}%` : '—'}</td>
                    <td>
                      <span className="ab-avail-pct">
                        {r.efforts_pct != null ? `${100 - r.efforts_pct}%` : '100%'}
                      </span>
                    </td>
                    <td>
                      {(r.billing || '').toLowerCase() === 'billable' && r.billability_pct != null
                        ? `${r.billability_pct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Billable Resources */}
      <div className="ab-lead-section">
        <div className="ab-section-label">Billable Resources ({billableResources.length})</div>
        {billableResources.length === 0 ? (
          <p className="ab-empty">No billable resources found in your team.</p>
        ) : (
          <div className="ab-table-wrap ab-table-scroll">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Name</th><th>Designation</th><th>Function</th>
                  <th>Project</th><th>Status</th><th>Effort %</th><th>Billability %</th>
                </tr>
              </thead>
              <tbody>
                {billableResources.map((r, i) => (
                  <tr key={i} className="ab-tr-click" onClick={() => onEmployeeClick(r.employee_id)}>
                    <td>{fmt(r.name)}</td>
                    <td>{fmt(r.designation)}</td>
                    <td>{fmt(r.function)}</td>
                    <td>{fmt(r.project_name)}</td>
                    <td>{fmt(r.project_status)}</td>
                    <td>{r.efforts_pct != null ? `${r.efforts_pct}%` : '—'}</td>
                    <td>{r.billability_pct != null ? `${r.billability_pct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Business Lead: My Projects */}
      {role === 'business_lead' && (
        <div className="ab-lead-section">
          <div className="ab-section-label">My Projects ({myProjects.length})</div>
          {myProjects.length === 0 ? (
            <p className="ab-empty">No projects found where you are Project Lead or Delivery Manager.</p>
          ) : (
            <div className="ab-project-cards">
              {myProjects.map((proj, i) => (
                <div key={i} className="ab-project-card" onClick={() => setProjectModal(proj)}>
                  <div className="ab-project-name">{proj.project_name}</div>
                  <div className="ab-project-count">{proj.resources.length} resource{proj.resources.length !== 1 ? 's' : ''}</div>
                  <div className="ab-project-hint">Click to view resources</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team / reportees drill modal */}
      {teamModal && (
        <DrillModal
          drill={teamModal}
          onClose={() => setTeamModal(null)}
          onRowClick={r => { setTeamModal(null); onEmployeeClick(r.employee_id); }}
        />
      )}

      {/* Project detail modal (business_lead) */}
      {projectModal && (
        <div className="ab-drill-overlay" onClick={() => setProjectModal(null)}>
          <div className="ab-drill-modal" onClick={e => e.stopPropagation()}>
            <div className="ab-drill-header">
              <h4>{projectModal.project_name}</h4>
              <span className="ab-count">{projectModal.resources.length} resources</span>
              <button className="ab-detail-close" onClick={() => setProjectModal(null)}>✕</button>
            </div>
            <div className="ab-drill-body">
              <div className="ab-table-wrap">
                <table className="ab-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Designation</th><th>Function</th>
                      <th>Status</th><th>Billing</th><th>Effort %</th><th>Billability %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectModal.resources.map((r, i) => (
                      <tr key={i} className="ab-tr-click"
                        onClick={() => { setProjectModal(null); onEmployeeClick(r.employee_id); }}>
                        <td>{fmt(r.name)}</td>
                        <td>{fmt(r.designation)}</td>
                        <td>{fmt(r.function)}</td>
                        <td>{fmt(r.project_status)}</td>
                        <td>{fmt(r.billing)}</td>
                        <td>{r.efforts_pct != null ? `${r.efforts_pct}%` : '—'}</td>
                        <td>{r.billability_pct != null ? `${r.billability_pct}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Lead view ────────────────────────────────────────────────────────────

function TeamView({ data, onEmployeeClick }) {
  const team = data.team_rows || [];
  return (
    <div className="ab-team-view">
      <div className="ab-section-label">Your Team ({team.length} members)</div>
      {team.length === 0 ? (
        <p className="ab-empty">No direct reportees found for your profile.</p>
      ) : (
        <>
          <div className="ab-emp-grid">
            {team.map((emp, i) => (
              <div key={i} className="ab-emp-card" onClick={() => onEmployeeClick(emp.employee_id)}>
                <div className="ab-emp-avatar">{(emp.name || '?')[0].toUpperCase()}</div>
                <div className="ab-emp-info">
                  <div className="ab-emp-name">{emp.name}</div>
                  <div className="ab-emp-desig">{fmt(emp.designation)}</div>
                  <div className="ab-emp-project">{emp.project_name || 'No Allocation'}</div>
                  {emp.primary_skills && (
                    <div className="ab-emp-skills">{emp.primary_skills}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="ab-table-wrap ab-table-scroll">
            <table className="ab-table">
              <thead>
                <tr>
                  <th>Name</th><th>Designation</th><th>Project</th>
                  <th>Status</th><th>Billing</th><th>Allocation Date</th>
                </tr>
              </thead>
              <tbody>
                {team.map((r, i) => (
                  <tr key={i} className="ab-tr-click" onClick={() => onEmployeeClick(r.employee_id)}>
                    <td>{fmt(r.name)}</td>
                    <td>{fmt(r.designation)}</td>
                    <td>{fmt(r.project_name)}</td>
                    <td>{fmt(r.project_status)}</td>
                    <td>{fmt(r.billing)}</td>
                    <td>{fmtDate(r.allocation_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Employee (self) view ──────────────────────────────────────────────────────

function SelfView({ data }) {
  const rows = data.my_allocation || [];
  return (
    <div className="ab-self-view">
      <div className="ab-section-label">My Allocation</div>
      {rows.length === 0 ? (
        <p className="ab-empty">No allocation records found for your profile.</p>
      ) : (
        <div className="ab-table-wrap">
          <table className="ab-table">
            <thead>
              <tr>
                <th>Project</th><th>Sub Project</th><th>Function</th>
                <th>Status</th><th>Billing</th><th>Allocation Date</th><th>SOW</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{fmt(r.project_name)}</td>
                  <td>{fmt(r.sub_project)}</td>
                  <td>{fmt(r.function)}</td>
                  <td>{fmt(r.project_status)}</td>
                  <td>{fmt(r.billing)}</td>
                  <td>{fmtDate(r.allocation_date)}</td>
                  <td>{fmt(r.sow_name)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Ask Aura chat panel ───────────────────────────────────────────────────────


const AURA_HINTS = {
  executive: [
    'Which employees are on No Allocation?',
    'Show all billable resources',
    'Who has less than 50% effort across the org?',
    'List all projects and their headcount',
    'Which functions have the most available capacity?',
  ],
  business_lead: [
    'Which of my projects are understaffed?',
    'Who is available in my team?',
    'Show billable resources in my team',
    'Who has less than 50% effort?',
    'Which resources am I leading on projects?',
  ],
  functional_lead: [
    'Who is available in my team?',
    'Show billable resources in my team',
    'Who has less than 50% effort?',
    'How many reportees do I have?',
    'List my team members by project',
  ],
  default: [
    'Who is available in my team?',
    'Which projects am I leading?',
    'Show billable resources in my team',
    'Who has less than 50% effort?',
    'How many reportees do I have?',
  ],
};

function AskAuraPanel({ onClose, role }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: "Hi! I'm Aura." }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = React.useRef(null);
  const inputRef  = React.useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await askAllocationAura(q);
      setMessages(prev => [...prev, { role: 'assistant', text: res.answer }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e.message}`, error: true }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading]);

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
              {m.role === 'assistant' && (
                <div className="ab-aura-msg-avatar"><i className="fas fa-robot" /></div>
              )}
              <div className="ab-aura-msg-bubble">{m.text}</div>
            </div>
          ))}
          {loading && (
            <div className="ab-aura-msg ab-aura-msg--assistant">
              <div className="ab-aura-msg-avatar"><i className="fas fa-robot" /></div>
              <div className="ab-aura-msg-bubble ab-aura-typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && !loading && (
          <div className="ab-aura-hints">
            {(AURA_HINTS[role] || AURA_HINTS.default).map((h, i) => (
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
            disabled={loading}
          />
          <button
            className="ab-aura-send"
            onClick={() => send()}
            disabled={!input.trim() || loading}
          >
            <i className="fas fa-paper-plane" />
          </button>
        </div>
      </div>
    </>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function AllocationBoard() {
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

  const ROLE_LABEL = {
    executive:       'Executive',
    business_lead:   'Business Lead',
    functional_lead: 'Functional Lead',
    team_lead:       'Team Lead',
    employee:        'Employee',
  };

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

  const roleLabel   = ROLE_LABEL[boardData.role] || boardData.role;
  const notInSystem = !boardData.designation;

  return (
    <div className="ab-root">
      <div className="ab-header">
        <div>
          <h2 className="ab-title">Allocation Board</h2>
          <div className="ab-header-meta">
            <span className="ab-role-badge">{roleLabel}</span>
          </div>
        </div>
        <button className="ab-ask-aura-btn" onClick={() => setAuraOpen(true)}>
          <i className="fas fa-robot" />
          Ask Aura
        </button>
      </div>

      {notInSystem && (
        <div className="ab-notice">
          <i className="fa fa-info-circle" style={{ marginRight: '0.5rem' }} />
          Your profile was not found in employee records. Contact HR or Admin to update your designation.
        </div>
      )}

      <EmpDrawer emp={drawerEmp} loading={drawerLoading} onClose={closeDrawer} />
      {auraOpen && <AskAuraPanel onClose={() => setAuraOpen(false)} role={boardData.role} />}

      {boardData.role === 'executive' && (
        <ExecutiveView data={boardData} onEmployeeClick={handleEmployeeClick} />
      )}
      {(boardData.role === 'functional_lead' || boardData.role === 'business_lead') && (
        <LeadView data={boardData} onEmployeeClick={handleEmployeeClick} role={boardData.role} />
      )}
      {boardData.role === 'team_lead' && (
        <TeamView data={boardData} onEmployeeClick={handleEmployeeClick} />
      )}
      {boardData.role === 'employee' && (
        <SelfView data={boardData} />
      )}
    </div>
  );
}
