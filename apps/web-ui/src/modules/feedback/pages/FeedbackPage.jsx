import React, { useState, useEffect } from 'react';
import { getFeedback, submitFeedback } from '../services/feedbackService';

const TYPES = [
  { id: 'improvement', label: 'Improvement',  icon: 'fa-arrow-up-right-dots', color: '#1D76BC' },
  { id: 'bug',         label: 'Bug Report',    icon: 'fa-bug',                 color: '#DC2626' },
  { id: 'suggestion',  label: 'Suggestion',    icon: 'fa-lightbulb',           color: '#D97706' },
  { id: 'compliment',  label: 'Compliment',    icon: 'fa-heart',               color: '#16A34A' },
];

const MODULES = [
  'AI Assistant', 'HR Assistant', 'IT Support', 'Document Hub',
  'Org Intelligence', 'PMO / Project Hub', 'Skill Radar',
  'Allocation Board', 'Communications', 'Onboarding Guidance', 'General / Other',
];

const STATUS_META = {
  open:     { label: 'Open',     color: '#1D76BC' },
  reviewed: { label: 'Reviewed', color: '#D97706' },
  resolved: { label: 'Resolved', color: '#16A34A' },
  closed:   { label: 'Closed',   color: '#6b7280' },
};

const EMPTY = { type: 'improvement', module: MODULES[0], title: '', description: '', rating: 0 };

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', fontSize: 20 }}
        >
          <i className={`${(hovered || value) >= n ? 'fas' : 'far'} fa-star`}
             style={{ color: (hovered || value) >= n ? '#F59E0B' : 'var(--border)' }} />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage({ user }) {
  const [form, setForm]         = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFeedback()
      .then(rows => { if (!cancelled) setHistory(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.title.trim() && form.description.trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      const entry = await submitFeedback({ ...form, userName: user?.name, userEmail: user?.email });
      setHistory(prev => [entry, ...prev]);
      setSubmitted(true);
      setTimeout(() => { setSubmitted(false); setForm(EMPTY); }, 2500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-comment-dots" style={{ color: '#7C3AED' }} />
          Share Feedback
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0', fontSize: 14 }}>
          Help us improve  Aura — share bugs, ideas, or suggestions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'start' }}>

        {/* ── Submission form ── */}
        <form onSubmit={handleSubmit}>
          <div className="fb-card" style={{ marginBottom: 0 }}>

            {submitted && (
              <div className="fb-toast fb-toast--success">
                <i className="fas fa-circle-check" />
                Thank you! Your feedback has been submitted.
              </div>
            )}

            {/* Type chips */}
            <div className="fb-field">
              <label className="fb-label">Feedback Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TYPES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => field('type', t.id)}
                    className={`fb-type-chip${form.type === t.id ? ' fb-type-chip--active' : ''}`}
                    style={{ '--chip-color': t.color }}
                  >
                    <i className={`fas ${t.icon}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Module */}
            <div className="fb-field">
              <label className="fb-label">Related Module</label>
              <select
                value={form.module}
                onChange={e => field('module', e.target.value)}
                className="fb-input"
              >
                {MODULES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {/* Title */}
            <div className="fb-field">
              <label className="fb-label">Title <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                value={form.title}
                onChange={e => field('title', e.target.value)}
                placeholder="Short summary of your feedback…"
                className="fb-input"
                maxLength={120}
              />
            </div>

            {/* Description */}
            <div className="fb-field">
              <label className="fb-label">Description <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea
                value={form.description}
                onChange={e => field('description', e.target.value)}
                placeholder="Describe the issue or idea in detail…"
                className="fb-input fb-textarea"
                rows={4}
              />
            </div>

            {/* Rating */}
            <div className="fb-field">
              <label className="fb-label">Overall Experience</label>
              <StarRating value={form.rating} onChange={v => field('rating', v)} />
            </div>

            <button
              type="submit"
              disabled={!isValid || submitted || submitting}
              className="fb-submit-btn"
            >
              <i className="fas fa-paper-plane" />
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        </form>

        {/* ── Previous submissions ── */}
        <div>
          <div className="fb-card-title" style={{ marginBottom: 12 }}>
            <i className="fas fa-clock-rotate-left" style={{ color: '#7C3AED' }} />
            Your Previous Submissions
            <span className="fb-count">{history.length}</span>
          </div>

          {loading ? (
            <div className="fb-empty">
              <p>Loading…</p>
            </div>
          ) : history.length === 0 ? (
            <div className="fb-empty">
              <i className="fas fa-inbox" style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }} />
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map(item => {
                const t = TYPES.find(t => t.id === item.type) || TYPES[0];
                const s = STATUS_META[item.status] || STATUS_META.open;
                return (
                  <div key={item.id} className="fb-history-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className="fb-type-pill" style={{ '--chip-color': t.color }}>
                        <i className={`fas ${t.icon}`} />{t.label}
                      </span>
                      <span className="fb-status-pill" style={{ '--status-color': s.color }}>
                        {s.label}
                      </span>
                      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>
                        {new Date(item.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.module}</div>
                    {item.adminNotes && (
                      <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', fontSize: 11, color: 'var(--text-secondary)' }}>
                        <i className="fas fa-reply" style={{ marginRight: 5, color: '#7C3AED' }} />
                        <strong>Admin:</strong> {item.adminNotes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}