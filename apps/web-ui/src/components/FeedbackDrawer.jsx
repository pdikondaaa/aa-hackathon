import React, { useState } from 'react';
import { getFeedback, submitFeedback } from '../modules/feedback/services/feedbackService';

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

const FeedbackDrawer = ({ isOpen, onClose, user }) => {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isValid = form.title.trim() && form.description.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) return;
    submitFeedback({ ...form, userName: user?.name, userEmail: user?.email });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm(EMPTY);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="drawer-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />

      {/* Drawer */}
      <div
        className="feedback-drawer"
        style={{
          position: 'fixed',
          top: 60,
          right: 0,
          width: '420px',
          maxHeight: 'calc(100vh - 60px)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px 0 0 8px',
          boxShadow: '-2px 4px 16px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          overflowY: 'auto',
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-comment-dots" style={{ color: '#7C3AED', fontSize: 18 }} />
            <h3 style={{ color: 'var(--text)', margin: 0, fontSize: 16, fontWeight: 700 }}>
              Share Feedback
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: 20,
              padding: 0,
            }}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px' }}>
          {submitted && (
            <div
              className="fb-toast fb-toast--success"
              style={{
                marginBottom: 12,
                padding: '12px 14px',
                borderRadius: 6,
                background: 'rgba(78,212,78,0.12)',
                border: '1px solid rgba(78,212,78,0.3)',
                color: '#4ED44E',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-circle-check" />
              Thank you! Your feedback has been submitted.
            </div>
          )}

          {/* Type chips */}
          <div className="fb-field" style={{ marginBottom: 14 }}>
            <label className="fb-label" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Feedback Type
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TYPES.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => field('type', t.id)}
                  className={`fb-type-chip${form.type === t.id ? ' fb-type-chip--active' : ''}`}
                  style={{
                    '--chip-color': t.color,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: form.type === t.id ? t.color + '15' : 'transparent',
                    color: form.type === t.id ? t.color : 'var(--text-secondary)',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className={`fas ${t.icon}`} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module */}
          <div className="fb-field" style={{ marginBottom: 14 }}>
            <label className="fb-label" style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
              Related Module
            </label>
            <select
              value={form.module}
              onChange={e => field('module', e.target.value)}
              className="fb-input"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            >
              {MODULES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Title */}
          <div className="fb-field" style={{ marginBottom: 14 }}>
            <label className="fb-label" style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
              Title <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              value={form.title}
              onChange={e => field('title', e.target.value)}
              placeholder="Short summary of your feedback…"
              className="fb-input"
              maxLength={120}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
              }}
            />
          </div>

          {/* Description */}
          <div className="fb-field" style={{ marginBottom: 14 }}>
            <label className="fb-label" style={{ marginBottom: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
              Description <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => field('description', e.target.value)}
              placeholder="Describe the issue or idea in detail…"
              className="fb-textarea"
              rows={4}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />
          </div>

          {/* Rating */}
          <div className="fb-field" style={{ marginBottom: 16 }}>
            <label className="fb-label" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
              Overall Experience
            </label>
            <StarRating value={form.rating} onChange={v => field('rating', v)} />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isValid || submitted}
            className="fb-submit-btn"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#7C3AED',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: isValid && !submitted ? 'pointer' : 'default',
              opacity: isValid && !submitted ? 1 : 0.45,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <i className="fas fa-paper-plane" />
            {submitted ? 'Submitted...' : 'Submit Feedback'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default FeedbackDrawer;
