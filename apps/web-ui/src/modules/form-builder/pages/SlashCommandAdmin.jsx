import React, { useState, useEffect, useCallback } from 'react';
import {
  adminListSlashCommands, adminCreateSlashCommand,
  adminUpdateSlashCommand, adminDeleteSlashCommand,
  adminListForms,
} from '../services/formBuilderApi';

const TYPE_META = {
  form:    { label: 'Form',         icon: 'fa-file-alt',          color: '#1D76BC' },
  url:     { label: 'URL Shortcut', icon: 'fa-external-link-alt', color: '#0F766E' },
  builtin: { label: 'Built-in',     icon: 'fa-bolt',              color: '#7C3AED' },
};

const BUILTIN_ACTIONS = [
  { value: 'parking',    label: 'Parking Tracker',    icon: 'fa-car' },
  { value: 'escalation', label: 'Escalation / Raise a Concern', icon: 'fa-exclamation-triangle' },
];

/* ── Helpers ── */
function Badge({ type }) {
  const m = TYPE_META[type] || TYPE_META.form;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: `${m.color}18`, color: m.color,
      padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    }}>
      <i className={`fas ${m.icon}`} style={{ fontSize: 9 }} />
      {m.label}
    </span>
  );
}

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 20, borderRadius: 10, border: 'none',
        background: value ? 'var(--success)' : 'var(--border)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: value ? 20 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  );
}

/* ── Command row ── */
function CmdRow({ cmd, onEdit, onDelete, onToggle }) {
  const [hov, setHov] = useState(false);
  const target = cmd.type === 'form'
    ? (cmd.form_name || cmd.form_id || '—')
    : cmd.type === 'builtin'
      ? (BUILTIN_ACTIONS.find(a => a.value === cmd.action)?.label || cmd.action || '—')
      : (cmd.url || '—');

  return (
    <tr
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ background: hov ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.12s' }}
    >
      <td style={TD}>
        <code style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          padding: '2px 8px', borderRadius: 5, fontSize: 13,
          color: 'var(--primary)', fontWeight: 700,
        }}>
          /{cmd.command}
        </code>
      </td>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cmd.icon && (
            <i className={`fas ${cmd.icon}`} style={{ color: 'var(--text-muted)', fontSize: 13 }} />
          )}
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{cmd.label}</span>
        </div>
        {cmd.description && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{cmd.description}</div>
        )}
      </td>
      <td style={TD}><Badge type={cmd.type} /></td>
      <td style={{ ...TD, maxWidth: 240 }}>
        <span style={{
          fontSize: 12, color: 'var(--text-secondary)',
          display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={target}>
          {target}
        </span>
      </td>
      <td style={{ ...TD, width: 70 }}>
        <ToggleSwitch value={cmd.is_active} onChange={(v) => onToggle(cmd.id, v)} />
      </td>
      <td style={{ ...TD, width: 100 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <IBtn icon="fa-edit" title="Edit" onClick={() => onEdit(cmd)} />
          <IBtn icon="fa-trash" title="Delete" danger
            onClick={() => window.confirm(`Delete "/${cmd.command}"?`) && onDelete(cmd.id)} />
        </div>
      </td>
    </tr>
  );
}

const TD = {
  padding: '11px 14px',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
};

function IBtn({ icon, title, onClick, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? (danger ? 'rgba(239,68,68,0.1)' : 'var(--bg-card)') : 'transparent',
        border: `1px solid ${hov ? (danger ? 'var(--error)' : 'var(--border)') : 'transparent'}`,
        color: danger ? (hov ? 'var(--error)' : 'var(--text-muted)') : 'var(--text-muted)',
        borderRadius: 6, padding: '5px 8px', fontSize: 12,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      <i className={`fas ${icon}`} />
    </button>
  );
}

/* ── Modal ── */
const EMPTY_FORM = {
  command: '', label: '', description: '', type: 'form',
  form_id: '', url: '', action: '', icon: '', is_active: true, order_index: 0,
};

function CommandModal({ cmd, onClose, onSave, publishedForms }) {
  const isEdit = !!cmd?.id;
  const [form, setForm] = useState(isEdit ? {
    command:     cmd.command,
    label:       cmd.label,
    description: cmd.description || '',
    type:        cmd.type,
    form_id:     cmd.form_id || '',
    url:         cmd.url || '',
    action:      cmd.action || '',
    icon:        cmd.icon || '',
    is_active:   cmd.is_active,
    order_index: cmd.order_index,
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.command.trim()) return setError('Command keyword is required');
    if (!form.label.trim())   return setError('Label is required');
    if (form.type === 'form'    && !form.form_id)     return setError('Please select a form');
    if (form.type === 'url'     && !form.url.trim())  return setError('URL is required');
    if (form.type === 'builtin' && !form.action)      return setError('Please select a built-in action');

    setSaving(true); setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 14, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(29,118,188,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--primary)', fontSize: 14,
            }}>
              <i className="fas fa-slash" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {isEdit ? 'Edit Slash Command' : 'New Slash Command'}
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 16,
          }}>
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Type selector */}
          <div>
            <Label>Command Type</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['form', 'url', 'builtin'].map(t => {
                const m = TYPE_META[t];
                const active = form.type === t;
                return (
                  <button
                    key={t}
                    onClick={() => set('type', t)}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 8,
                      border: `2px solid ${active ? m.color : 'var(--border)'}`,
                      background: active ? `${m.color}15` : 'var(--bg-elevated)',
                      color: active ? m.color : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.15s',
                    }}
                  >
                    <i className={`fas ${m.icon}`} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Row>
            <FieldWrap label="Command keyword" hint="Text after / (e.g. parking)">
              <FieldInput
                value={form.command}
                onChange={v => set('command', v.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="parking"
                disabled={isEdit}
                prefix="/"
              />
            </FieldWrap>
            <FieldWrap label="Icon" hint="FontAwesome class (optional)">
              <FieldInput
                value={form.icon}
                onChange={v => set('icon', v)}
                placeholder="fa-car"
              />
            </FieldWrap>
          </Row>

          <FieldWrap label="Display Label">
            <FieldInput value={form.label} onChange={v => set('label', v)} placeholder="Parking Request" />
          </FieldWrap>

          <FieldWrap label="Description (optional)">
            <FieldInput value={form.description} onChange={v => set('description', v)} placeholder="Submit a parking request" />
          </FieldWrap>

          {form.type === 'form' && (
            <FieldWrap label="Form">
              <select
                value={form.form_id}
                onChange={e => set('form_id', e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="">— Select a published form —</option>
                {publishedForms.map(f => (
                  <option key={f.id} value={f.id}>{f.name}{f.alias ? ` (/${f.alias})` : ''}</option>
                ))}
              </select>
            </FieldWrap>
          )}
          {form.type === 'url' && (
            <FieldWrap label="URL" hint="Opens in a new browser tab">
              <FieldInput value={form.url} onChange={v => set('url', v)} placeholder="https://..." />
            </FieldWrap>
          )}
          {form.type === 'builtin' && (
            <FieldWrap label="Built-in Action">
              <select
                value={form.action}
                onChange={e => set('action', e.target.value)}
                style={SELECT_STYLE}
              >
                <option value="">— Select a built-in action —</option>
                {BUILTIN_ACTIONS.map(a => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </FieldWrap>
          )}

          <Row>
            <FieldWrap label="Order (lower = higher priority)">
              <FieldInput
                type="number"
                value={String(form.order_index)}
                onChange={v => set('order_index', parseInt(v, 10) || 0)}
              />
            </FieldWrap>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Active</Label>
              <div style={{ paddingTop: 6 }}>
                <ToggleSwitch value={form.is_active} onChange={v => set('is_active', v)} />
              </div>
            </div>
          </Row>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid var(--error)',
              borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--error)',
            }}>
              <i className="fas fa-exclamation-circle" style={{ marginRight: 6 }} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 22px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}>
          <button onClick={onClose} style={BTN_GHOST}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={BTN_PRIMARY}>
            {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Saving…</> : (isEdit ? 'Save Changes' : 'Create Command')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Small helpers ── */
const Label = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>
    {children}
  </div>
);

const FieldWrap = ({ label, hint, children }) => (
  <div style={{ flex: 1 }}>
    <Label>{label}{hint && <span style={{ textTransform: 'none', fontWeight: 400, marginLeft: 4 }}>· {hint}</span>}</Label>
    {children}
  </div>
);

function FieldInput({ value, onChange, placeholder, disabled, type = 'text', prefix }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
      {prefix && <span style={{ padding: '0 8px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          padding: '8px 10px', fontSize: 13, color: disabled ? 'var(--text-muted)' : 'var(--text)',
        }}
      />
    </div>
  );
}

const Row = ({ children }) => <div style={{ display: 'flex', gap: 12 }}>{children}</div>;

const SELECT_STYLE = {
  width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '8px 10px', fontSize: 13, color: 'var(--text)',
  outline: 'none', cursor: 'pointer',
};

const BTN_PRIMARY = {
  background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700,
  cursor: 'pointer',
};

const BTN_GHOST = {
  background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', borderRadius: 7,
  padding: '8px 16px', fontSize: 13, cursor: 'pointer',
};

/* ── Main page ── */
export default function SlashCommandAdmin() {
  const [commands, setCommands]         = useState([]);
  const [publishedForms, setPublished]  = useState([]);
  const [loading, setLoading]           = useState(true);
  const [modalCmd, setModalCmd]         = useState(null); // null = closed, {} = new, {...} = edit
  const [modalOpen, setModalOpen]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cmds, forms] = await Promise.all([
        adminListSlashCommands(),
        adminListForms({ status: 'published', limit: 100 }),
      ]);
      setCommands(cmds.items || []);
      setPublished(forms.items || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData) => {
    if (modalCmd?.id) {
      await adminUpdateSlashCommand(modalCmd.id, formData);
    } else {
      await adminCreateSlashCommand(formData);
    }
    await load();
  };

  const handleDelete = async (id) => {
    try {
      await adminDeleteSlashCommand(id);
      await load();
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const handleToggle = async (id, is_active) => {
    try {
      await adminUpdateSlashCommand(id, { is_active });
      setCommands(prev => prev.map(c => c.id === id ? { ...c, is_active } : c));
    } catch (e) {
      alert('Update failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const openNew  = () => { setModalCmd({});   setModalOpen(true); };
  const openEdit = (cmd) => { setModalCmd(cmd); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setModalCmd(null); };

  const active   = commands.filter(c => c.is_active).length;
  const formCmds = commands.filter(c => c.type === 'form').length;
  const urlCmds  = commands.filter(c => c.type === 'url').length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(29,118,188,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)', fontSize: 18,
              }}>
                <i className="fas fa-bolt" />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0 }}>
                  Slash Commands
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Configure the <code style={{ color: 'var(--primary)' }}>/</code> menu shortcuts available in the chat
                </p>
              </div>
            </div>
          </div>
          <button onClick={openNew} style={{
            background: 'var(--primary)', color: '#fff', border: 'none',
            borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 8px rgba(29,118,188,0.35)',
          }}>
            <i className="fas fa-plus" /> New Command
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { icon: 'fa-bolt',              value: commands.length, label: 'Total Commands',  color: '#1D76BC' },
            { icon: 'fa-check-circle',      value: active,          label: 'Active',          color: '#22c55e' },
            { icon: 'fa-file-alt',          value: formCmds,        label: 'Form Shortcuts',  color: '#1D76BC' },
            { icon: 'fa-external-link-alt', value: urlCmds,         label: 'URL Shortcuts',   color: '#0F766E' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 12,
              flex: '1 1 140px', minWidth: 0,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `${s.color}22`, color: s.color, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className={`fas ${s.icon}`} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: 10 }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 18 }} />
              <span style={{ fontSize: 13 }}>Loading slash commands…</span>
            </div>
          ) : commands.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
              <i className="fas fa-bolt" style={{ fontSize: 40, marginBottom: 14, color: 'var(--border)' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>No slash commands yet</div>
              <div style={{ fontSize: 13, marginBottom: 18 }}>
                Create commands to let users quickly access forms or URLs via <code>/</code> in the chat.
              </div>
              <button onClick={openNew} style={{ ...BTN_PRIMARY, padding: '9px 20px' }}>
                <i className="fas fa-plus" style={{ marginRight: 7 }} />Create Command
              </button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {['Command', 'Label', 'Type', 'Target', 'Active', ''].map(h => (
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
                {commands.map(cmd => (
                  <CmdRow
                    key={cmd.id}
                    cmd={cmd}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Help note */}
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: 'rgba(29,118,188,0.07)', border: '1px solid rgba(29,118,188,0.2)',
          borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <i className="fas fa-info-circle" style={{ color: 'var(--primary)', marginTop: 1 }} />
          <span>
            Users type <strong>/</strong> in the chat to open the command menu. Commands are matched by keyword, label, or description.
            <strong> Form commands</strong> open the form in a panel. <strong>URL commands</strong> open the link in a new tab.
          </span>
        </div>
      </div>

      {modalOpen && (
        <CommandModal
          cmd={modalCmd}
          publishedForms={publishedForms}
          onClose={closeModal}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
