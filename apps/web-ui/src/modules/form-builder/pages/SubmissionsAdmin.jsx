import React, { useState, useEffect, useCallback } from 'react';
import {
  adminListAllSubmissions, adminListForms,
  adminUpdateSubmissionStatus, adminListWorkflows,
  adminDeleteSubmission,
} from '../services/formBuilderApi';

const STATUS_META = {
  submitted:  { color: '#1D76BC', bg: 'rgba(29,118,188,0.12)', icon: 'fa-paper-plane' },
  in_review:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: 'fa-clock' },
  approved:   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: 'fa-check-circle' },
  rejected:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: 'fa-times-circle' },
  withdrawn:  { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: 'fa-ban' },
};

const STATUSES = ['submitted', 'in_review', 'approved', 'rejected', 'withdrawn'];

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: 'fa-circle' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: m.bg, color: m.color,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <i className={`fas ${m.icon}`} style={{ fontSize: 9 }} />
      {status.replace('_', ' ')}
    </span>
  );
}

/* ── CSV Export helper ── */
function exportCSV(submissions) {
  if (!submissions.length) return;
  const headers = ['Submission ID', 'Form', 'Version', 'Submitted By', 'Email', 'Status', 'Date'];
  const rows = submissions.map(s => [
    s.id, s.form_name, s.form_version,
    s.submitted_by_name || s.submitted_by_email,
    s.submitted_by_email, s.status,
    new Date(s.created_at).toISOString(),
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Section heading inside modal ── */
function SectionHead({ icon, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
      paddingBottom: 7, borderBottom: '1px solid var(--border)',
      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {icon && <i className={`fas ${icon}`} style={{ fontSize: 10 }} />}
      {children}
    </div>
  );
}

const FieldLabel = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7,
  }}>
    {children}
  </div>
);

/* ── Detail Modal ── */
function SubmissionDetailModal({ sub, onClose, onStatusChange, onDelete, currentUserEmail }) {
  const [status, setStatus]               = useState(sub.status);
  const [notes, setNotes]                 = useState(sub.review_notes || '');
  const [saving, setSaving]               = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]                 = useState('');
  const [canReview, setCanReview]         = useState(false);

  useEffect(() => {
    adminListWorkflows({ form_id: sub.form_id })
      .then(data => {
        const workflows = data.items || [];
        let approver = false;
        for (const wf of workflows) {
          for (const step of (wf.steps || [])) {
            if (step.type !== 'approval') continue;
            const cfg = step.config || {};
            if (cfg.approver_mode === 'dynamic') {
              const fieldVal = sub.data?.[cfg.approver_field] || '';
              const emails = fieldVal.split(/[,;]/).map(e => e.trim().toLowerCase());
              if (emails.includes((currentUserEmail || '').toLowerCase())) approver = true;
            } else {
              const list = cfg.approvers || [];
              if (list.some(a => (a.email || a).toLowerCase() === (currentUserEmail || '').toLowerCase())) approver = true;
            }
          }
        }
        setCanReview(approver);
      })
      .catch(() => setCanReview(false));
  }, [sub.form_id, sub.data, currentUserEmail]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await onStatusChange(sub.id, { status, review_notes: notes });
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true); setError('');
    try {
      await onDelete(sub.id);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Delete failed');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const fields = Object.entries(sub.data || {});

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 660,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      }}>

        {/* ── Modal Header ── */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: 'rgba(29,118,188,0.15)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
              }}>
                <i className="fas fa-file-alt" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{sub.form_name}</span>
                  <StatusBadge status={sub.status} />
                  <code style={{
                    fontSize: 10, color: 'var(--text-muted)',
                    background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 5,
                  }}>
                    v{sub.form_version}
                  </code>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0 10px' }}>
                  <span><i className="fas fa-user" style={{ marginRight: 4, fontSize: 9 }} />{sub.submitted_by_name || sub.submitted_by_email}</span>
                  <span><i className="fas fa-envelope" style={{ marginRight: 4, fontSize: 9 }} />{sub.submitted_by_email}</span>
                  <span><i className="fas fa-clock" style={{ marginRight: 4, fontSize: 9 }} />{new Date(sub.created_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '4px', borderRadius: 6, flexShrink: 0 }}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* Submitted Data */}
          <div style={{ marginBottom: 24 }}>
            <SectionHead icon="fa-database">Submitted Data</SectionHead>
            {fields.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No data submitted</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {fields.map(([key, val]) => (
                  <div key={key} style={{
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '10px 14px',
                    display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, alignItems: 'start',
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--primary)',
                      textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.85, lineHeight: 1.4,
                    }}>
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {Array.isArray(val)
                        ? val.join(', ') || '—'
                        : typeof val === 'object' && val !== null
                          ? <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{JSON.stringify(val, null, 2)}</pre>
                          : String(val ?? '—')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Review Notes (read-only, for non-approvers) */}
          {sub.review_notes && !canReview && (
            <div style={{ marginBottom: 20 }}>
              <SectionHead icon="fa-comment-dots">Review Notes</SectionHead>
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13,
                color: 'var(--text)', lineHeight: 1.6,
              }}>
                {sub.review_notes}
              </div>
              {sub.reviewed_by_email && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                  Reviewed by {sub.reviewed_by_email}
                  {sub.reviewed_at && ` · ${new Date(sub.reviewed_at).toLocaleString()}`}
                </div>
              )}
            </div>
          )}

          {/* Review Section — approvers only */}
          {canReview && (
            <div>
              <SectionHead icon="fa-gavel">Review</SectionHead>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <FieldLabel>Approval Status</FieldLabel>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUSES.map(s => {
                      const m = STATUS_META[s];
                      const active = status === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(s)}
                          style={{
                            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                            border: `2px solid ${active ? m.color : 'var(--border)'}`,
                            background: active ? m.bg : 'transparent',
                            color: active ? m.color : 'var(--text-muted)',
                            fontSize: 11, fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                            transition: 'all 0.12s',
                          }}
                        >
                          {s.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <FieldLabel>Review Notes</FieldLabel>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Optional notes visible to the submitter…"
                    rows={3}
                    style={{
                      width: '100%', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 8,
                      padding: '10px 12px', fontSize: 13, color: 'var(--text)',
                      resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      fontFamily: 'inherit', lineHeight: 1.5,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              padding: '8px 12px', fontSize: 12, color: '#ef4444',
            }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }} />{error}
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        {confirmDelete ? (
          <div style={{
            padding: '16px 22px', borderTop: '1px solid var(--border)',
            background: 'rgba(239,68,68,0.05)', flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', marginBottom: 12 }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: 7 }} />
              Permanently delete this submission? This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                style={BTN_GHOST}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={BTN_DANGER}
              >
                {deleting
                  ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Deleting…</>
                  : <><i className="fas fa-trash" style={{ marginRight: 6 }} />Delete</>}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
            padding: '14px 22px', borderTop: '1px solid var(--border)',
            background: 'var(--bg-elevated)', flexShrink: 0,
          }}>
            <button onClick={() => setConfirmDelete(true)} style={BTN_DANGER}>
              <i className="fas fa-trash" style={{ marginRight: 6 }} />Delete
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} style={BTN_GHOST}>Close</button>
              {canReview && (
                <button onClick={handleSave} disabled={saving} style={BTN_PRIMARY}>
                  {saving
                    ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Saving…</>
                    : 'Update Status'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Table row ── */
function SubRow({ sub, onClick, onDelete }) {
  const [hov, setHov]               = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const dataEntries = Object.entries(sub.data || {});
  const firstField  = dataEntries[0];

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setConfirmDel(false); }}
      style={{
        background: confirmDel
          ? 'rgba(239,68,68,0.05)'
          : hov ? 'var(--bg-elevated)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* Form */}
      <td style={TD} onClick={onClick}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{sub.form_name}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>v{sub.form_version}</div>
      </td>
      {/* Submitted By */}
      <td style={TD} onClick={onClick}>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>{sub.submitted_by_name || sub.submitted_by_email}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{sub.submitted_by_email}</div>
      </td>
      {/* Data preview */}
      <td style={{ ...TD, maxWidth: 180 }} onClick={onClick}>
        {firstField ? (
          <div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {firstField[0].replace(/_/g, ' ')}:{' '}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {String(firstField[1] ?? '').slice(0, 40)}{String(firstField[1] ?? '').length > 40 ? '…' : ''}
            </span>
            {dataEntries.length > 1 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>+{dataEntries.length - 1}</span>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
        )}
      </td>
      {/* Status */}
      <td style={TD} onClick={onClick}>
        <StatusBadge status={sub.status} />
      </td>
      {/* Date */}
      <td style={{ ...TD, fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }} onClick={onClick}>
        {new Date(sub.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      {/* Actions */}
      <td style={{ ...TD, width: 110, cursor: 'default' }}>
        {confirmDel ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, marginRight: 2 }}>Sure?</span>
            <button
              onClick={e => { e.stopPropagation(); onDelete(sub.id); }}
              style={{
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 5, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Yes
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDel(false); }}
              style={{
                background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '3px 7px', fontSize: 11, cursor: 'pointer',
              }}
            >
              No
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', opacity: hov ? 1 : 0, transition: 'opacity 0.15s' }}>
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              title="View details"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 9px', fontSize: 12,
                cursor: 'pointer', color: 'var(--primary)',
              }}
            >
              <i className="fas fa-eye" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
              title="Delete submission"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '5px 9px', fontSize: 12,
                cursor: 'pointer', color: '#ef4444',
              }}
            >
              <i className="fas fa-trash" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ── Shared styles ── */
const TD = {
  padding: '11px 14px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
  cursor: 'pointer',
};

const BTN_PRIMARY = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
};

const BTN_GHOST = {
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 7,
  padding: '8px 16px', fontSize: 13, cursor: 'pointer',
};

const BTN_DANGER = {
  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
};

const SEL_STYLE = {
  background: 'transparent', border: 'none', outline: 'none',
  fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', maxWidth: 200,
};

/* ── Pill button ── */
function PillBtn({ active, onClick, count, label, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: `2px solid ${active ? color : 'var(--border)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--text-muted)',
        cursor: 'pointer', transition: 'all 0.12s',
        display: 'flex', alignItems: 'center', gap: 5,
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? color : 'var(--bg-elevated)',
          color: active ? '#fff' : 'var(--text-muted)',
          borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700,
        }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Pagination button ── */
function PagBtn({ children, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 7, padding: '6px 11px', fontSize: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-muted)' : 'var(--text)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/* ── Main page ── */
export default function SubmissionsAdmin({ currentUserEmail }) {
  const [submissions, setSubmissions]     = useState([]);
  const [forms, setForms]                 = useState([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [filterForm, setFilterForm]       = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState(null);
  const limit = 25;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filterForm)   params.form_id = filterForm;
      if (filterStatus) params.status  = filterStatus;
      if (search)       params.search  = search;
      const data = await adminListAllSubmissions(params);
      setSubmissions(data.items || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, filterForm, filterStatus, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    adminListForms({ limit: 100 })
      .then(d => setForms(d.items || []))
      .catch(() => {});
  }, []);

  // Debounce search → reset to page 1
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleStatusChange = async (submissionId, body) => {
    await adminUpdateSubmissionStatus(submissionId, body);
    await load();
  };

  const handleDelete = async (submissionId) => {
    await adminDeleteSubmission(submissionId);
    setSelected(null);
    await load();
  };

  const totalPages  = Math.ceil(total / limit);

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = submissions.filter(x => x.status === s).length;
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          marginBottom: 24, gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11,
              background: 'rgba(29,118,188,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)', fontSize: 17,
            }}>
              <i className="fas fa-inbox" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                Submitted Data
              </h1>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                View and manage all form submissions across all forms
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {total} submission{total !== 1 ? 's' : ''}
            </span>
            {submissions.length > 0 && (
              <button
                onClick={() => exportCSV(submissions)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: 7,
                  padding: '7px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <i className="fas fa-download" style={{ fontSize: 11 }} />
                Export CSV
              </button>
            )}
          </div>
        </div>

        {/* ── Status quick-filter pills ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <PillBtn
            active={!filterStatus}
            onClick={() => { setFilterStatus(''); setPage(1); }}
            count={total} label="All" color="#1D76BC"
          />
          {STATUSES.map(s => {
            const m = STATUS_META[s];
            return (
              <PillBtn
                key={s}
                active={filterStatus === s}
                onClick={() => { setFilterStatus(filterStatus === s ? '' : s); setPage(1); }}
                count={filterStatus === s ? total : statusCounts[s]}
                label={s.replace('_', ' ')}
                color={m.color}
              />
            );
          })}
        </div>

        {/* ── Filters bar ── */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 14px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: 13 }} />
          <input
            style={{ flex: '1 1 180px', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)' }}
            placeholder="Search by submitter email or form name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <i className="fas fa-times" />
            </button>
          )}
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
          <select
            value={filterForm}
            onChange={e => { setFilterForm(e.target.value); setPage(1); }}
            style={SEL_STYLE}
          >
            <option value="">All Forms</option>
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        {/* ── Table ── */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: 10 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 18 }} />
              <span style={{ fontSize: 13 }}>Loading submissions…</span>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
              <i className="fas fa-inbox" style={{ fontSize: 40, marginBottom: 14, color: 'var(--border)' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {filterForm || filterStatus || search ? 'No submissions match your filters' : 'No submissions yet'}
              </div>
              <div style={{ fontSize: 13 }}>
                {filterForm || filterStatus || search
                  ? 'Try adjusting your filters.'
                  : 'Submissions will appear here once forms are published and filled.'}
              </div>
              {(filterForm || filterStatus || search) && (
                <button
                  onClick={() => { setFilterForm(''); setFilterStatus(''); setSearch(''); setPage(1); }}
                  style={{
                    marginTop: 14, background: 'var(--bg-elevated)', color: 'var(--text)',
                    border: '1px solid var(--border)', borderRadius: 7, padding: '7px 16px',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <i className="fas fa-times" style={{ marginRight: 6 }} />Clear Filters
                </button>
              )}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Form', 'Submitted By', 'Preview', 'Status', 'Date', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {submissions.map(sub => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    onClick={() => setSelected(sub)}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 24 }}>
            <PagBtn disabled={page === 1} onClick={() => setPage(1)}><i className="fas fa-angles-left" /></PagBtn>
            <PagBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}><i className="fas fa-chevron-left" /></PagBtn>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '5px 12px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border)' }}>
              {page} / {totalPages}
            </span>
            <PagBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><i className="fas fa-chevron-right" /></PagBtn>
            <PagBtn disabled={page === totalPages} onClick={() => setPage(totalPages)}><i className="fas fa-angles-right" /></PagBtn>
          </div>
        )}
      </div>

      {selected && (
        <SubmissionDetailModal
          sub={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          currentUserEmail={currentUserEmail}
        />
      )}
    </div>
  );
}
