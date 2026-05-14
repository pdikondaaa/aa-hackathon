import React, { useState } from 'react';
import { submitEscalation } from '../services/api';

const ESCALATION_TYPES = ['HR', 'IT', 'Admin', 'Organization'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const PRIORITY_COLORS = {
  Low:      { bg: 'rgba(78,212,78,0.12)',   text: '#4ED44E' },
  Medium:   { bg: 'rgba(39,170,225,0.12)',  text: '#27AAE1' },
  High:     { bg: 'rgba(245,158,11,0.14)',  text: '#f59e0b' },
  Critical: { bg: 'rgba(240,82,82,0.14)',   text: '#f05252' },
};

const INITIAL_FORM = {
  escalation_type: '',
  subject: '',
  reason: '',
  priority: '',
  category: '',
  affected_system: '',
  business_impact: '',
  requested_action: '',
};

const EscalationDrawer = ({ isOpen, onClose, user }) => {
  const [form, setForm]         = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.escalation_type || !form.subject || !form.reason || !form.priority) {
      setError('Please fill in all required fields.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitEscalation({
        conversation_id: null,
        message_id: null,
        escalation_type: form.escalation_type,
        subject: form.subject,
        reason: form.reason,
        priority: form.priority,
        form_payload: {
          category:         form.category         || null,
          affected_system:  form.affected_system  || null,
          business_impact:  form.business_impact  || null,
          requested_action: form.requested_action || null,
        },
      });

      setSubmitted(true);
      setForm(INITIAL_FORM);
    } catch (err) {
      setError('Failed to submit escalation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setError(null);
    setForm(INITIAL_FORM);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="esc-backdrop"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`esc-drawer${isOpen ? ' esc-drawer--open' : ''}`}
        aria-label="Raise Escalation"
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div className="esc-drawer-header">
          <div className="esc-drawer-title-row">
            <div className="esc-drawer-icon">
              <i className="fas fa-exclamation-triangle" />
            </div>
            <div>
              <h2 className="esc-drawer-title">Raise Escalation</h2>
              <p className="esc-drawer-subtitle">Submit an issue to the appropriate team</p>
            </div>
          </div>
          <button className="esc-close-btn" onClick={handleClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Success state */}
        {submitted ? (
          <div className="esc-success">
            <div className="esc-success-icon">
              <i className="fas fa-check-circle" />
            </div>
            <h3>Escalation Submitted</h3>
            <p>Your escalation has been recorded and routed to the appropriate team. You'll receive an update shortly.</p>
            <button className="esc-btn-primary" onClick={handleClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="esc-form" onSubmit={handleSubmit} noValidate>

            {/* ── Core Fields ─────────────────────────────────── */}
            <section className="esc-section">
              <p className="esc-section-label">Escalation Details</p>

              <div className="esc-field">
                <label className="esc-label">
                  Escalation Type <span className="esc-required">*</span>
                </label>
                <div className="esc-type-grid">
                  {ESCALATION_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={`esc-type-chip${form.escalation_type === type ? ' selected' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, escalation_type: type }))}
                    >
                      <i className={`fas ${typeIcon(type)}`} />
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="esc-field">
                <label className="esc-label" htmlFor="esc-subject">
                  Subject <span className="esc-required">*</span>
                </label>
                <input
                  id="esc-subject"
                  className="esc-input"
                  type="text"
                  name="subject"
                  placeholder="Brief description of the issue"
                  value={form.subject}
                  onChange={handleChange}
                  maxLength={500}
                />
              </div>

              <div className="esc-field">
                <label className="esc-label" htmlFor="esc-reason">
                  Justification <span className="esc-required">*</span>
                </label>
                <textarea
                  id="esc-reason"
                  className="esc-textarea"
                  name="reason"
                  placeholder="Explain the issue in detail and why it needs escalation..."
                  value={form.reason}
                  onChange={handleChange}
                  rows={4}
                />
              </div>

              <div className="esc-field">
                <label className="esc-label">
                  Priority <span className="esc-required">*</span>
                </label>
                <div className="esc-priority-row">
                  {PRIORITIES.map((p) => {
                    const colors = PRIORITY_COLORS[p];
                    const selected = form.priority === p;
                    return (
                      <button
                        type="button"
                        key={p}
                        className={`esc-priority-chip${selected ? ' selected' : ''}`}
                        style={selected ? { background: colors.bg, color: colors.text, borderColor: colors.text } : {}}
                        onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ── Additional Context ──────────────────────────── */}
            <section className="esc-section">
              <p className="esc-section-label">Additional Context</p>

              <div className="esc-field-row">
                <div className="esc-field">
                  <label className="esc-label" htmlFor="esc-category">Category</label>
                  <input
                    id="esc-category"
                    className="esc-input"
                    type="text"
                    name="category"
                    placeholder="e.g. Access Issue"
                    value={form.category}
                    onChange={handleChange}
                  />
                </div>
                <div className="esc-field">
                  <label className="esc-label" htmlFor="esc-affected-system">Affected System</label>
                  <input
                    id="esc-affected-system"
                    className="esc-input"
                    type="text"
                    name="affected_system"
                    placeholder="e.g. VPN, Payroll"
                    value={form.affected_system}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="esc-field">
                <label className="esc-label" htmlFor="esc-business-impact">Business Impact</label>
                <input
                  id="esc-business-impact"
                  className="esc-input"
                  type="text"
                  name="business_impact"
                  placeholder="Describe the impact on work or operations"
                  value={form.business_impact}
                  onChange={handleChange}
                />
              </div>

              <div className="esc-field">
                <label className="esc-label" htmlFor="esc-requested-action">Requested Action</label>
                <input
                  id="esc-requested-action"
                  className="esc-input"
                  type="text"
                  name="requested_action"
                  placeholder="What resolution are you expecting?"
                  value={form.requested_action}
                  onChange={handleChange}
                />
              </div>
            </section>

            {/* ── Submitter info (read-only) ──────────────────── */}
            {user && (
              <div className="esc-submitter-row">
                <div className="esc-submitter-avatar">
                  {(user.initials || user.name?.slice(0, 2) || 'U').toUpperCase()}
                </div>
                <div className="esc-submitter-info">
                  <span className="esc-submitter-name">{user.name || user.email}</span>
                  <span className="esc-submitter-email">{user.email}</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="esc-error">
                <i className="fas fa-exclamation-circle" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="esc-actions">
              <button type="button" className="esc-btn-secondary" onClick={handleClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="esc-btn-primary" disabled={submitting}>
                {submitting ? (
                  <><i className="fas fa-spinner fa-spin" /> Submitting…</>
                ) : (
                  <><i className="fas fa-paper-plane" /> Submit Escalation</>
                )}
              </button>
            </div>

          </form>
        )}
      </aside>
    </>
  );
};

function typeIcon(type) {
  switch (type) {
    case 'HR':           return 'fa-user-tie';
    case 'IT':           return 'fa-laptop-code';
    case 'Admin':        return 'fa-building';
    case 'Organization': return 'fa-sitemap';
    default:             return 'fa-tag';
  }
}

export default EscalationDrawer;
