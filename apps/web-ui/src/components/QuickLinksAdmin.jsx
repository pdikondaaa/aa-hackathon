import React, { useState } from 'react';
import {
  DEFAULT_QUICK_LINKS,
  getQuickLinks,
  saveQuickLinks,
  resetQuickLinks,
} from '../config/quickLinksConfig';

const COLOR_PRESETS = [
  '#1D76BC', '#27AAE1', '#2A3D90', '#7C3AED', '#9333EA',
  '#E8562A', '#DC2626', '#f05252', '#16A34A', '#0891B2',
  '#0F766E', '#D97706', '#5e7a9a',
];

const ICON_SUGGESTIONS = [
  'fa-link', 'fa-building', 'fa-robot', 'fa-address-book', 'fa-users',
  'fa-headset', 'fa-file-contract', 'fa-money-bill-wave', 'fa-receipt',
  'fa-comments', 'fa-clipboard-list', 'fa-chart-line', 'fa-globe',
  'fa-envelope', 'fa-calendar', 'fa-cog', 'fa-database', 'fa-code',
  'fa-shield-alt', 'fa-star', 'fa-bookmark', 'fa-tools',
];

const EMPTY_FORM = { id: '', label: '', url: '', icon: 'fa-link', iconImg: '', color: '#1D76BC' };

function IconPreview({ icon, iconImg, color }) {
  const [imgErr, setImgErr] = useState(false);
  if (iconImg && !imgErr) {
    return (
      <img
        src={iconImg}
        alt=""
        style={{ width: 20, height: 20, objectFit: 'contain' }}
        onError={() => setImgErr(true)}
      />
    );
  }
  return <i className={`fas ${icon || 'fa-link'}`} style={{ color, fontSize: 16 }} />;
}

export default function QuickLinksAdmin({ user }) {
  const [links, setLinks] = useState(getQuickLinks());
  const [editingIdx, setEditingIdx] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveMsg, setSaveMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const flash = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const persist = (updated) => {
    saveQuickLinks(updated);
    setLinks(updated);
  };

  const startAdd = () => {
    setAdding(true);
    setEditingIdx(null);
    setForm({ ...EMPTY_FORM });
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setAdding(false);
    setForm({ ...links[idx] });
  };

  const cancelForm = () => {
    setEditingIdx(null);
    setAdding(false);
    setForm(EMPTY_FORM);
  };

  const submitForm = () => {
    if (!form.label.trim() || !form.url.trim()) return;
    const entry = {
      ...form,
      id: form.id.trim() || form.label.trim().toLowerCase().replace(/\s+/g, '-'),
      label: form.label.trim(),
      url: form.url.trim(),
      iconImg: form.iconImg.trim() || undefined,
    };
    if (!entry.iconImg) delete entry.iconImg;

    let updated;
    if (adding) {
      updated = [...links, entry];
    } else {
      updated = links.map((l, i) => (i === editingIdx ? entry : l));
    }
    persist(updated);
    flash(adding ? 'Link added.' : 'Link updated.');
    cancelForm();
  };

  const deleteLink = (idx) => {
    persist(links.filter((_, i) => i !== idx));
    flash('Link removed.');
    setDeleteConfirm(null);
  };

  const moveLink = (idx, dir) => {
    const arr = [...links];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    persist(arr);
  };

  const handleReset = () => {
    resetQuickLinks();
    setLinks(DEFAULT_QUICK_LINKS);
    flash('Quick links reset to defaults.');
  };

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const isFormValid = form.label.trim() && form.url.trim();

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="fas fa-th" style={{ color: 'var(--primary)' }} />
            Quick Links Setup
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 }}>
            Configure the quick access links shown in the top-bar launcher for all users.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0, alignItems: 'center' }}>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <i className="fas fa-undo" /> Reset to Defaults
          </button>
          <button
            onClick={startAdd}
            disabled={adding || editingIdx !== null}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: (adding || editingIdx !== null) ? 0.5 : 1,
            }}
          >
            <i className="fas fa-plus" /> Add Link
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {saveMsg && (
        <div style={{
          background: 'rgba(78,212,78,0.12)', border: '1px solid #4ED44E',
          borderRadius: 8, padding: '10px 16px', marginBottom: 20,
          color: '#4ED44E', fontSize: 13,
        }}>
          <i className="fas fa-check-circle" style={{ marginRight: 8 }} />{saveMsg}
        </div>
      )}

      {/* ── Add form ── */}
      {adding && (
        <LinkForm
          form={form}
          field={field}
          isValid={isFormValid}
          onSubmit={submitForm}
          onCancel={cancelForm}
          title="Add New Link"
        />
      )}

      {/* ── Links table ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {links.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No quick links configured. Click <strong>Add Link</strong> to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['', 'Label', 'URL', 'Icon', 'Actions'].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 16px', textAlign: 'left', fontSize: 11,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '0.07em', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {links.map((link, idx) => (
                <React.Fragment key={link.id || idx}>
                  <tr style={{ borderBottom: editingIdx === idx ? 'none' : '1px solid var(--border-light)' }}>
                    {/* Order */}
                    <td style={{ padding: '10px 12px', width: 64 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button
                          onClick={() => moveLink(idx, -1)}
                          disabled={idx === 0}
                          title="Move up"
                          style={moveBtn(idx === 0)}
                        ><i className="fas fa-chevron-up" /></button>
                        <button
                          onClick={() => moveLink(idx, 1)}
                          disabled={idx === links.length - 1}
                          title="Move down"
                          style={moveBtn(idx === links.length - 1)}
                        ><i className="fas fa-chevron-down" /></button>
                      </div>
                    </td>

                    {/* Label */}
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                      {link.label}
                    </td>

                    {/* URL */}
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 260 }}>
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={link.url}>
                        {link.url}
                      </span>
                    </td>

                    {/* Icon preview */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 8,
                        background: (link.color || '#1D76BC') + '20',
                      }}>
                        <IconPreview icon={link.icon} iconImg={link.iconImg} color={link.color || '#1D76BC'} />
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => startEdit(idx)}
                          disabled={adding || (editingIdx !== null && editingIdx !== idx)}
                          style={actionBtn('var(--primary)', adding || (editingIdx !== null && editingIdx !== idx))}
                        >
                          <i className="fas fa-pen" /> Edit
                        </button>
                        {deleteConfirm === idx ? (
                          <>
                            <button onClick={() => deleteLink(idx)} style={actionBtn('#f05252', false)}>
                              <i className="fas fa-check" /> Confirm
                            </button>
                            <button onClick={() => setDeleteConfirm(null)} style={actionBtn('var(--text-muted)', false)}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(idx)}
                            disabled={adding || editingIdx !== null}
                            style={actionBtn('#f05252', adding || editingIdx !== null)}
                          >
                            <i className="fas fa-trash" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit form */}
                  {editingIdx === idx && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 16px', background: 'var(--bg-card)' }}>
                        <LinkForm
                          form={form}
                          field={field}
                          isValid={isFormValid}
                          onSubmit={submitForm}
                          onCancel={cancelForm}
                          title="Edit Link"
                          inline
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
        Changes take effect immediately for all users. The order here matches the display order in the Quick Links panel.
      </p>
    </div>
  );
}

function LinkForm({ form, field, isValid, onSubmit, onCancel, title, inline }) {
  return (
    <div style={{
      background: inline ? 'var(--bg)' : 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: inline ? 0 : 24,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-pen" style={{ color: 'var(--primary)', fontSize: 13 }} />
        {title}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>

        <FormField label="Label *">
          <input
            value={form.label}
            onChange={(e) => field('label', e.target.value)}
            placeholder="e.g. Zoho People"
            style={inputStyle}
          />
        </FormField>

        <FormField label="URL *">
          <input
            value={form.url}
            onChange={(e) => field('url', e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </FormField>

        <FormField label="Font Awesome Icon">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={form.icon}
              onChange={(e) => field('icon', e.target.value)}
              placeholder="fa-link"
              style={{ ...inputStyle, flex: 1 }}
            />
            <i className={`fas ${form.icon || 'fa-link'}`} style={{ color: form.color || '#1D76BC', fontSize: 18, width: 24 }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {ICON_SUGGESTIONS.slice(0, 12).map((ic) => (
              <button
                key={ic}
                onClick={() => field('icon', ic)}
                title={ic}
                style={{
                  padding: '4px 8px', border: form.icon === ic ? '1px solid var(--primary)' : '1px solid var(--border)',
                  borderRadius: 6, background: form.icon === ic ? 'rgba(29,118,188,0.12)' : 'transparent',
                  cursor: 'pointer', fontSize: 13,
                }}
              >
                <i className={`fas ${ic}`} style={{ color: form.icon === ic ? 'var(--primary)' : 'var(--text-secondary)' }} />
              </button>
            ))}
          </div>
        </FormField>

        <FormField label="Accent Color">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="color"
              value={form.color || '#1D76BC'}
              onChange={(e) => field('color', e.target.value)}
              style={{ width: 38, height: 32, padding: 2, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: 'transparent' }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{form.color || '#1D76BC'}</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => field('color', c)}
                  title={c}
                  style={{
                    width: 20, height: 20, borderRadius: 4, background: c, border: form.color === c ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </FormField>

        <FormField label="Image URL (optional)" span>
          <input
            value={form.iconImg || ''}
            onChange={(e) => field('iconImg', e.target.value)}
            placeholder="https://... (overrides FA icon when set)"
            style={inputStyle}
          />
        </FormField>

      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          disabled={!isValid}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: isValid ? 'var(--primary)' : 'var(--border)',
            color: isValid ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: 600, cursor: isValid ? 'pointer' : 'default',
          }}
        >
          <i className="fas fa-check" style={{ marginRight: 6 }} />
          Save Link
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children, span }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'var(--bg-card)',
  color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const moveBtn = (disabled) => ({
  width: 22, height: 20, padding: 0, border: '1px solid var(--border)',
  borderRadius: 4, background: 'transparent',
  color: disabled ? 'var(--border)' : 'var(--text-secondary)',
  cursor: disabled ? 'default' : 'pointer', fontSize: 10,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const actionBtn = (color, disabled) => ({
  padding: '5px 10px', borderRadius: 6, border: `1px solid ${color}44`,
  background: `${color}15`, color, fontSize: 12, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  display: 'flex', alignItems: 'center', gap: 4,
});
