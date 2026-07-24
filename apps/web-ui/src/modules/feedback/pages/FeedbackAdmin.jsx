import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getFeedbackForAdmin, updateFeedback, deleteFeedback } from '../services/feedbackService';

const TYPES = [
  { id: 'improvement', label: 'Improvement',  icon: 'fa-arrow-up-right-dots', color: '#1D76BC' },
  { id: 'bug',         label: 'Bug Report',    icon: 'fa-bug',                 color: '#DC2626' },
  { id: 'suggestion',  label: 'Suggestion',    icon: 'fa-lightbulb',           color: '#D97706' },
  { id: 'compliment',  label: 'Compliment',    icon: 'fa-heart',               color: '#16A34A' },
];

const STATUS_OPTIONS = [
  { id: 'open',     label: 'Open',     color: '#1D76BC' },
  { id: 'reviewed', label: 'Reviewed', color: '#D97706' },
  { id: 'resolved', label: 'Resolved', color: '#16A34A' },
  { id: 'closed',   label: 'Closed',   color: '#6b7280' },
];

function StatCard({ icon, label, value, color }) {
  return (
    <div className="fb-stat-card">
      <div className="fb-stat-icon" style={{ background: `${color}18`, color }}>
        <i className={`fas ${icon}`} />
      </div>
      <div>
        <div className="fb-stat-value">{value}</div>
        <div className="fb-stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function FeedbackAdmin({ user }) {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded]     = useState(null);
  const [notesDraft, setNotesDraft] = useState({});
  const [statusDraft, setStatusDraft] = useState({});
  const [saveMsg, setSaveMsg]       = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const flash = (msg) => { setSaveMsg(msg); setTimeout(() => setSaveMsg(''), 2500); };

  const reload = useCallback(() => {
    return getFeedbackForAdmin({ limit: 200 }).then(setItems);
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleUpdate = async (id) => {
    await updateFeedback(id, {
      status: statusDraft[id] || items.find(i => i.id === id)?.status,
      adminNotes: notesDraft[id] ?? items.find(i => i.id === id)?.adminNotes,
    });
    await reload();
    flash('Feedback updated.');
  };

  const handleDelete = async (id) => {
    await deleteFeedback(id);
    await reload();
    setDeleteConfirm(null);
    setExpanded(null);
    flash('Feedback deleted.');
  };

  const filtered = useMemo(() => items.filter(item => {
    if (typeFilter   !== 'all' && item.type   !== typeFilter)   return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  }), [items, typeFilter, statusFilter]);

  const counts = useMemo(() => ({
    total:    items.length,
    open:     items.filter(i => i.status === 'open').length,
    reviewed: items.filter(i => i.status === 'reviewed').length,
    resolved: items.filter(i => i.status === 'resolved').length,
  }), [items]);

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-comment-dots" style={{ color: '#7C3AED' }} />
          Feedback Review
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0', fontSize: 14 }}>
          Review, respond to, and manage user-submitted feedback.
        </p>
      </div>

      {saveMsg && (
        <div className="fb-toast fb-toast--success" style={{ marginBottom: 20 }}>
          <i className="fas fa-circle-check" />{saveMsg}
        </div>
      )}

      {/* Stat cards */}
      <div className="fb-stats-row" style={{ marginBottom: 24 }}>
        <StatCard icon="fa-inbox"        label="Total"    value={counts.total}    color="#7C3AED" />
        <StatCard icon="fa-circle-dot"   label="Open"     value={counts.open}     color="#1D76BC" />
        <StatCard icon="fa-eye"          label="Reviewed" value={counts.reviewed} color="#D97706" />
        <StatCard icon="fa-circle-check" label="Resolved" value={counts.resolved} color="#16A34A" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type:</span>
          {[{ id: 'all', label: 'All' }, ...TYPES].map(t => (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className={`fb-filter-btn${typeFilter === t.id ? ' fb-filter-btn--active' : ''}`}
              style={{ '--fc': t.color || 'var(--primary)' }}>
              {t.icon && <i className={`fas ${t.icon}`} />}{t.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status:</span>
          {[{ id: 'all', label: 'All', color: 'var(--primary)' }, ...STATUS_OPTIONS].map(s => (
            <button key={s.id} onClick={() => setStatusFilter(s.id)}
              className={`fb-filter-btn${statusFilter === s.id ? ' fb-filter-btn--active' : ''}`}
              style={{ '--fc': s.color }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="fb-card" style={{ padding: 0 }}>
        {loading ? (
          <div className="fb-empty" style={{ padding: '48px 24px' }}>
            <p>Loading…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="fb-empty" style={{ padding: '48px 24px' }}>
            <i className="fas fa-inbox" style={{ fontSize: 32, marginBottom: 10, opacity: 0.25 }} />
            <p>No feedback matches the current filters.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Type', 'Title', 'Module', 'User', 'Rating', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => {
                const t = TYPES.find(t => t.id === item.type) || TYPES[0];
                const s = STATUS_OPTIONS.find(s => s.id === item.status) || STATUS_OPTIONS[0];
                const isExpanded = expanded === item.id;
                const curStatus  = statusDraft[item.id] ?? item.status;
                const curNotes   = notesDraft[item.id]  ?? item.adminNotes ?? '';

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      style={{
                        borderBottom: isExpanded ? 'none' : '1px solid var(--border-light)',
                        background: isExpanded ? 'rgba(124,58,237,0.04)' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                    >
                      <td style={{ padding: '11px 14px' }}>
                        <span className="fb-type-pill" style={{ '--chip-color': t.color }}>
                          <i className={`fas ${t.icon}`} />{t.label}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--text)', fontWeight: 500, maxWidth: 200 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.module}</td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{item.userName || item.userEmail || 'Anonymous'}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {item.rating > 0
                          ? <span style={{ color: '#F59E0B', fontSize: 12 }}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(item.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <span className="fb-status-pill" style={{ '--status-color': s.color }}>{s.label}</span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`} style={{ fontSize: 11, color: 'var(--text-muted)' }} />
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td colSpan={8} style={{ padding: '0 16px 16px', background: 'rgba(124,58,237,0.03)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 12 }}>

                            {/* Description */}
                            <div>
                              <div className="fb-label" style={{ marginBottom: 6 }}>User Description</div>
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-card)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)' }}>
                                {item.description}
                              </div>
                            </div>

                            {/* Admin response panel */}
                            <div>
                              <div className="fb-label" style={{ marginBottom: 6 }}>Admin Response</div>
                              <select
                                value={curStatus}
                                onChange={e => setStatusDraft(d => ({ ...d, [item.id]: e.target.value }))}
                                className="fb-input"
                                style={{ marginBottom: 8 }}
                                onClick={e => e.stopPropagation()}
                              >
                                {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                              </select>
                              <textarea
                                value={curNotes}
                                onChange={e => setNotesDraft(d => ({ ...d, [item.id]: e.target.value }))}
                                placeholder="Add a note visible to the user…"
                                className="fb-input fb-textarea"
                                rows={3}
                                onClick={e => e.stopPropagation()}
                              />
                              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleUpdate(item.id); }}
                                  className="fb-action-btn fb-action-btn--primary"
                                >
                                  <i className="fas fa-check" /> Save
                                </button>
                                {deleteConfirm === item.id ? (
                                  <>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="fb-action-btn fb-action-btn--danger">
                                      <i className="fas fa-check" /> Confirm Delete
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }} className="fb-action-btn">
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(item.id); }} className="fb-action-btn fb-action-btn--danger">
                                    <i className="fas fa-trash" /> Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}