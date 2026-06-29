import React, { useEffect, useState } from 'react';
import DynamicFormRenderer from './renderer/DynamicFormRenderer';
import { getFormBySlug } from '../services/formBuilderApi';

const s = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 440,
    maxWidth: '95vw',
    zIndex: 500,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    boxShadow: '-8px 0 32px rgba(0,0,0,0.25)',
    transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 9,
    background: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 14,
    flexShrink: 0,
  },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 },
  subtitle: { fontSize: 11, color: 'var(--text-muted)', marginTop: 1 },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 16,
    padding: 6,
    borderRadius: 6,
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    color: 'var(--text-muted)',
    fontSize: 14,
    gap: 8,
  },
  error: {
    padding: 24,
    textAlign: 'center',
    color: 'var(--error)',
    fontSize: 13,
  },
};

export default function FormChatPanel({ formRef, user, onClose }) {
  // formRef can be {slug} or {id, name, slug, icon, description} (from slash menu)
  const [form, setForm]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    if (!formRef) return;
    setLoading(true);
    setError(null);
    setForm(null);

    const slug = formRef.slug || formRef;
    getFormBySlug(slug)
      .then(data => setForm(data))
      .catch(e => setError(e.message || 'Could not load form'))
      .finally(() => setLoading(false));
  }, [formRef?.slug || formRef]);

  if (!formRef) return null;

  return (
    <div style={s.overlay}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.iconBadge}>
          <i className={`fas ${form?.icon || formRef?.icon || 'fa-file-alt'}`} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.title} title={form?.name || formRef?.name}>
            {form?.name || formRef?.name || 'Form'}
          </div>
          {(form?.category || formRef?.category) && (
            <div style={s.subtitle}>{form?.category || formRef?.category}</div>
          )}
        </div>
        <button style={s.closeBtn} onClick={onClose} title="Close">
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Body */}
      <div style={s.body}>
        {loading ? (
          <div style={s.loading}>
            <i className="fas fa-spinner fa-spin" />
            Loading form…
          </div>
        ) : error ? (
          <div style={s.error}>
            <i className="fas fa-exclamation-circle" style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
            {error}
            <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
              This form may not be published or accessible.
            </div>
          </div>
        ) : (
          <DynamicFormRenderer
            form={form}
            prefill={{}}
            metadata={{ source: 'chat_panel' }}
            onSuccess={onClose}
            compact={true}
          />
        )}
      </div>
    </div>
  );
}
