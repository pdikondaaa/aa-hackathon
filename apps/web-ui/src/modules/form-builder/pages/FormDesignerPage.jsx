import React, { useEffect, useState } from 'react';
import { useFormDesigner } from '../hooks/useFormDesigner';
import FieldPalette from '../components/designer/FieldPalette';
import DesignerCanvas from '../components/designer/DesignerCanvas';
import PropertiesPanel from '../components/designer/PropertiesPanel';
import AiFormDesigner from '../components/designer/AiFormDesigner';
import DynamicFormRenderer from '../components/renderer/DynamicFormRenderer';
import WorkflowDesigner from '../components/workflow/WorkflowDesigner';

const STATUS_COLORS = {
  draft:     { bg: 'rgba(245,158,11,0.13)', color: '#f59e0b' },
  published: { bg: 'rgba(78,212,78,0.13)',  color: 'var(--success)' },
  archived:  { bg: 'rgba(94,122,154,0.13)', color: 'var(--text-muted)' },
};

/* Tab definitions */
const ALL_TABS = [
  { id: 'fields',      label: 'Fields',      icon: 'fa-list-ul'         },
  { id: 'settings',    label: 'Settings',    icon: 'fa-sliders'          },
  { id: 'automation',  label: 'Automation',  icon: 'fa-diagram-project'  },
  { id: 'preview',     label: 'Preview',     icon: 'fa-eye'              },
];

const s = {
  page: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    overflow: 'hidden',
    background: 'var(--bg)',
  },

  /* ── Toolbar ── */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    minHeight: 54,
  },
  backBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '6px 8px', fontSize: 15,
    borderRadius: 7, display: 'flex', alignItems: 'center', gap: 6,
    flexShrink: 0,
  },
  divider: { width: 1, height: 24, background: 'var(--border)', flexShrink: 0 },
  formNameInput: {
    background: 'transparent', border: 'none',
    borderBottom: '1.5px solid transparent',
    padding: '3px 2px', fontSize: 15, fontWeight: 700,
    color: 'var(--text)', outline: 'none', minWidth: 160, maxWidth: 280,
    transition: 'border-color 0.15s',
  },
  statusPill: {
    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
    textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
  },

  /* ── Tabs ── */
  tabBar: {
    display: 'flex',
    flex: 1,
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
  },
  tab: {
    padding: '0 14px', height: 54, background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    color: 'var(--text-muted)',
    display: 'flex', alignItems: 'center', gap: 6,
    borderBottom: '2px solid transparent',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap', flexShrink: 0,
  },
  tabActive: {
    color: 'var(--primary)',
    borderBottomColor: 'var(--primary)',
  },
  tabAutomation: {
    color: '#0F766E',
    borderBottomColor: '#0F766E',
  },

  /* ── Toolbar right ── */
  toolbarRight: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 },
  statusMsg: { fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 },
  errorMsg:  { fontSize: 12, color: 'var(--error)',      display: 'flex', alignItems: 'center', gap: 5 },
  btn: {
    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text)',
    display: 'flex', alignItems: 'center', gap: 5,
  },
  primaryBtn: { background: 'var(--primary)', color: '#fff', border: 'none' },
  successBtn: { background: 'var(--success)',  color: '#fff', border: 'none' },

  /* ── Panels ── */
  designer: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 },
  scrollPanel: { flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 },

  /* ── Settings ── */
  settingsWrap: { maxWidth: 680, margin: '0 auto', padding: '28px 24px 48px' },
  settingsSection: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)',
  },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 },
  label: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 },
  input: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 7, padding: '8px 11px', fontSize: 13, color: 'var(--text)', outline: 'none',
  },

  /* ── Modal ── */
  modalBg: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
  },
  modal: {
    background: 'var(--bg-secondary)', borderRadius: 14, padding: '28px 32px',
    maxWidth: 420, width: '90%', border: '1px solid var(--border)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  },
};

/* ── Access Management component ── */
const PRESET_ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE', 'USER'];

function AccessManagementPanel({ allowedRoles, onChange }) {
  const [customInput, setCustomInput] = useState('');
  const isEveryone = !allowedRoles || allowedRoles.length === 0;

  const setMode = (everyone) => {
    onChange(everyone ? [] : ['ADMIN']);
  };

  const toggleRole = (role) => {
    if ((allowedRoles || []).includes(role)) {
      const next = (allowedRoles || []).filter(r => r !== role);
      onChange(next.length ? next : []);
    } else {
      onChange([...(allowedRoles || []), role]);
    }
  };

  const addCustom = () => {
    const r = customInput.trim().toUpperCase();
    if (r && !(allowedRoles || []).includes(r)) {
      onChange([...(allowedRoles || []), r]);
    }
    setCustomInput('');
  };

  const removeRole = (role) => onChange((allowedRoles || []).filter(r => r !== role));

  const customRoles = (allowedRoles || []).filter(r => !PRESET_ROLES.includes(r));

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          { id: 'everyone', icon: 'fa-globe', label: 'Everyone', desc: 'All authenticated users can access' },
          { id: 'limited',  icon: 'fa-lock',  label: 'Specific Roles', desc: 'Restrict to selected roles only' },
        ].map(opt => {
          const active = opt.id === 'everyone' ? isEveryone : !isEveryone;
          return (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id === 'everyone')}
              style={{
                flex: 1, padding: '12px 14px', borderRadius: 9, cursor: 'pointer',
                border: `2px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'rgba(29,118,188,0.08)' : 'var(--bg-elevated)',
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <i
                  className={`fas ${opt.icon}`}
                  style={{ fontSize: 12, color: active ? 'var(--primary)' : 'var(--text-muted)' }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: active ? 'var(--primary)' : 'var(--text)' }}>
                  {opt.label}
                </span>
                {active && (
                  <i className="fas fa-check-circle" style={{ fontSize: 12, color: 'var(--primary)', marginLeft: 'auto' }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 19 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Role selector (visible only in limited mode) */}
      {!isEveryone && (
        <div style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 9, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Allowed Roles
          </div>

          {/* Preset role checkboxes */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 12 }}>
            {PRESET_ROLES.map(role => {
              const checked = (allowedRoles || []).includes(role);
              return (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 13px', borderRadius: 20, cursor: 'pointer',
                    border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                    background: checked ? 'rgba(29,118,188,0.1)' : 'var(--bg-secondary)',
                    color: checked ? 'var(--primary)' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: checked ? 700 : 500,
                    transition: 'all 0.12s',
                  }}
                >
                  {checked && <i className="fas fa-check" style={{ fontSize: 10 }} />}
                  {role}
                </button>
              );
            })}
          </div>

          {/* Custom role input */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder="Add custom role (e.g. REVIEWER)…"
              style={{
                flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '7px 11px', fontSize: 12, color: 'var(--text)', outline: 'none',
              }}
            />
            <button
              onClick={addCustom}
              style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '7px 13px', fontSize: 12,
                color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>

          {/* Custom roles tags */}
          {customRoles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {customRoles.map(role => (
                <span
                  key={role}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(124,58,237,0.1)', color: '#7C3AED',
                    border: '1px solid rgba(124,58,237,0.3)',
                    borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                  }}
                >
                  {role}
                  <button
                    onClick={() => removeRole(role)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', padding: 0, lineHeight: 1, fontSize: 12 }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Summary */}
          {(allowedRoles || []).length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <i className="fas fa-shield-alt" style={{ marginRight: 5, color: 'var(--primary)' }} />
              Access restricted to: <strong style={{ color: 'var(--text)' }}>{(allowedRoles || []).join(', ')}</strong>
            </div>
          )}
        </div>
      )}

      {isEveryone && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 8, padding: '9px 13px', fontSize: 12, color: '#22c55e',
        }}>
          <i className="fas fa-check-circle" />
          All authenticated users can discover and fill this form.
        </div>
      )}
    </div>
  );
}

export default function FormDesignerPage({ formId: initialFormId, onBack }) {
  const [tab, setTab]                   = useState('fields');
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [formStatus, setFormStatus]     = useState('draft');
  const [designerMode, setDesignerMode] = useState('ai');   // 'ai' | 'manual'

  const designer = useFormDesigner(initialFormId);
  const {
    formId, formMeta, sections, fields,
    selectedField, selectedFieldId,
    saving, error,
    setFormMeta, setSelectedFieldId, setFields, setSections,
    loadForm, addField, moveField, updateField, removeField, duplicateField,
    addSection, saveForm, publishForm,
  } = designer;

  useEffect(() => { if (initialFormId) loadForm(initialFormId); }, [initialFormId]);

  const handleSave = async () => {
    try { await saveForm(); } catch { /* error surfaced by hook */ }
  };

  const handlePublish = async () => {
    try {
      await publishForm();
      setPublishConfirm(false);
      setFormStatus('published');
    } catch (e) { alert('Publish failed: ' + e.message); }
  };

  // Used by AI designer's Finalize flow: save then publish atomically
  const handleAiPublish = async () => {
    await saveForm();
    await publishForm();
    setFormStatus('published');
  };

  const previewForm = {
    id: formId || 'preview',
    slug: formMeta.slug || 'preview',
    name: formMeta.name || 'Preview',
    description: formMeta.description,
    settings: formMeta.settings || {},
    sections,
    fields,
  };

  const statusStyle = STATUS_COLORS[formStatus] || STATUS_COLORS.draft;

  /* Which tabs are visible: Automation only after form is saved */
  const visibleTabs = ALL_TABS.filter(t => t.id !== 'automation' || !!formId);

  return (
    <div style={s.page}>

      {/* ── Toolbar ── */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={onBack} title="Back to forms">
          <i className="fas fa-arrow-left" />
        </button>

        <div style={s.divider} />

        <input
          style={s.formNameInput}
          value={formMeta.name}
          placeholder="Untitled Form"
          onChange={e => setFormMeta(m => ({ ...m, name: e.target.value }))}
        />

        <span style={{ ...s.statusPill, background: statusStyle.bg, color: statusStyle.color }}>
          {formStatus}
        </span>

        <div style={s.divider} />

        {/* Tabs */}
        <div style={s.tabBar}>
          {visibleTabs.map(t => {
            const isActive = tab === t.id;
            const isAutomation = t.id === 'automation';
            return (
              <button
                key={t.id}
                style={{
                  ...s.tab,
                  ...(isActive ? (isAutomation ? s.tabAutomation : s.tabActive) : {}),
                }}
                onClick={() => setTab(t.id)}
                title={isAutomation && !formId ? 'Save the form first to access Automation' : t.label}
              >
                <i className={`fas ${t.icon}`} />
                {t.label}
                {isAutomation && (
                  <span style={{
                    fontSize: 9, fontWeight: 800, padding: '1px 5px',
                    background: isActive ? '#0F766E22' : 'rgba(15,118,110,0.1)',
                    color: '#0F766E', borderRadius: 8, letterSpacing: '0.05em',
                  }}>NEW</span>
                )}
              </button>
            );
          })}
        </div>

        <div style={s.divider} />

        {/* Right controls */}
        <div style={s.toolbarRight}>
          {saving && (
            <span style={s.statusMsg}>
              <i className="fas fa-spinner fa-spin" /> Saving…
            </span>
          )}
          {error && !saving && (
            <span style={s.errorMsg}>
              <i className="fas fa-exclamation-circle" /> {error}
            </span>
          )}
          <button style={s.btn} onClick={handleSave} disabled={saving}>
            <i className="fas fa-save" /> Save
          </button>
          {formStatus !== 'published' && (
            <button style={{ ...s.btn, ...s.primaryBtn }} onClick={() => setPublishConfirm(true)} disabled={saving}>
              <i className="fas fa-globe" /> Publish
            </button>
          )}
        </div>
      </div>

      {/* ── Tab panels ── */}

      {tab === 'fields' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>

          {/* ── Mode toggle bar ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            padding: '0 16px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            height: 40,
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Designer Mode
            </span>
            {[
              { id: 'ai',     icon: 'fa-wand-magic-sparkles', label: 'AI Assistant' },
              { id: 'manual', icon: 'fa-puzzle-piece',         label: 'Manual' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setDesignerMode(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px',
                  height: 28,
                  borderRadius: 7,
                  border: designerMode === m.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: designerMode === m.id ? 'rgba(29,118,188,0.12)' : 'var(--bg-elevated)',
                  color: designerMode === m.id ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: designerMode === m.id ? 700 : 500,
                  cursor: 'pointer',
                  marginRight: 6,
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fas ${m.icon}`} style={{ fontSize: 10 }} />
                {m.label}
                {m.id === 'ai' && (
                  <span style={{
                    fontSize: 8, fontWeight: 800, padding: '1px 4px',
                    background: designerMode === 'ai' ? 'rgba(29,118,188,0.2)' : 'rgba(124,58,237,0.15)',
                    color: designerMode === 'ai' ? 'var(--primary)' : '#7C3AED',
                    borderRadius: 6, letterSpacing: '0.04em',
                  }}>NEW</span>
                )}
              </button>
            ))}
          </div>

          {/* ── AI mode ── */}
          {designerMode === 'ai' && (
            <AiFormDesigner
              formId={formId}
              formMeta={formMeta}
              setFormMeta={setFormMeta}
              fields={fields}
              setFields={setFields}
              sections={sections}
              setSections={setSections}
              onSwitchToManual={() => setDesignerMode('manual')}
              onSave={handleSave}
              onPublish={handleAiPublish}
            />
          )}

          {/* ── Manual drag-and-drop mode ── */}
          {designerMode === 'manual' && (
            <div style={s.designer}>
              <FieldPalette onDragStart={() => {}} />
              <DesignerCanvas
                fields={fields}
                sections={sections}
                selectedFieldId={selectedFieldId}
                onSelectField={setSelectedFieldId}
                onAddField={addField}
                onMoveField={moveField}
                onRemoveField={removeField}
                onDuplicateField={duplicateField}
              />
              <PropertiesPanel
                field={selectedField}
                fields={fields}
                onUpdate={updateField}
              />
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div style={s.scrollPanel}>
          <div style={s.settingsWrap}>
            <div style={s.settingsSection}>
              <div style={s.sectionTitle}>Identity</div>
              {[
                ['Slug (URL-friendly identifier)', 'slug', 'leave-request'],
                ['Alias (for /slash commands)', 'alias', 'leave'],
                ['Category', 'category', 'HR'],
                ['Icon (FontAwesome class)', 'icon', 'fa-file-alt'],
              ].map(([lbl, key, ph]) => (
                <div key={key} style={s.fieldGroup}>
                  <label style={s.label}>{lbl}</label>
                  <input
                    style={s.input} value={formMeta[key] || ''} placeholder={ph}
                    onChange={e => setFormMeta(m => ({ ...m, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div style={s.fieldGroup}>
                <label style={s.label}>Description</label>
                <textarea
                  style={{ ...s.input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
                  value={formMeta.description || ''} placeholder="Describe this form…"
                  onChange={e => setFormMeta(m => ({ ...m, description: e.target.value }))}
                />
              </div>
            </div>

            <div style={s.settingsSection}>
              <div style={s.sectionTitle}>Submission</div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Submit Button Label</label>
                <input
                  style={s.input}
                  value={formMeta.settings?.submit_label || 'Submit'}
                  onChange={e => setFormMeta(m => ({ ...m, settings: { ...m.settings, submit_label: e.target.value } }))}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Success Message</label>
                <input
                  style={s.input}
                  value={formMeta.settings?.success_message || ''}
                  placeholder="Thank you! Your response has been submitted."
                  onChange={e => setFormMeta(m => ({ ...m, settings: { ...m.settings, success_message: e.target.value } }))}
                />
              </div>
            </div>

            <div style={s.settingsSection}>
              <div style={s.sectionTitle}>Access Management</div>
              <AccessManagementPanel
                allowedRoles={formMeta.allowed_roles || []}
                onChange={roles => setFormMeta(m => ({ ...m, allowed_roles: roles }))}
              />
            </div>
          </div>
        </div>
      )}

      {tab === 'automation' && formId && (
        <div style={s.scrollPanel}>
          <WorkflowDesigner formId={formId} />
        </div>
      )}

      {tab === 'preview' && (
        <div style={s.scrollPanel}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 48px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
              padding: '10px 14px',
              background: 'rgba(29,118,188,0.08)', borderRadius: 8,
              fontSize: 12, color: 'var(--primary)',
              border: '1px solid rgba(29,118,188,0.2)',
            }}>
              <i className="fas fa-eye" />
              This is a live preview — submissions are not saved.
            </div>
            <DynamicFormRenderer form={previewForm} onSuccess={() => {}} />
          </div>
        </div>
      )}

      {/* ── Publish modal ── */}
      {publishConfirm && (
        <div style={s.modalBg} onClick={() => setPublishConfirm(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              <i className="fas fa-globe" style={{ marginRight: 8, color: 'var(--success)' }} />
              Publish Form
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              Publishing will make this form available to all users matching the allowed roles.
              A version snapshot will be created and the form becomes discoverable via /slash commands.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={s.btn} onClick={() => setPublishConfirm(false)}>Cancel</button>
              <button style={{ ...s.btn, ...s.successBtn }} onClick={handlePublish}>
                <i className="fas fa-globe" /> Publish Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
