import React, { useState, useEffect, useRef } from 'react';
import {
  adminListWorkflows, adminCreateWorkflow,
  adminUpdateWorkflow, adminDeleteWorkflow,
  adminGetForm, adminSearchEmployees,
} from '../../services/formBuilderApi';

const STEP_TYPES = [
  { type: 'approval',     label: 'Approval',     icon: 'fa-user-check',   color: '#1D76BC' },
  { type: 'email',        label: 'Email',         icon: 'fa-envelope',     color: '#27AAE1' },
  { type: 'webhook',      label: 'Webhook',       icon: 'fa-plug',         color: '#4ED44E' },
  { type: 'api_call',     label: 'API Call',      icon: 'fa-code',         color: '#2A3D90' },
  { type: 'condition',    label: 'Condition',     icon: 'fa-code-branch',  color: '#f59e0b' },
  { type: 'notification', label: 'Notification',  icon: 'fa-bell',         color: '#0F766E' },
  { type: 'delay',        label: 'Delay',         icon: 'fa-clock',        color: '#6b7280' },
];

const STEP_TYPE_MAP = Object.fromEntries(STEP_TYPES.map(s => [s.type, s]));

const s = {
  container: { padding: '28px 32px 48px', maxWidth: 860, margin: '0 auto' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text)' },
  btn: {
    padding: '7px 16px',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtn: { background: 'var(--primary)', color: '#fff', border: 'none' },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '18px 20px',
    marginBottom: 12,
  },
  stepChain: { display: 'flex', flexDirection: 'column', gap: 0 },
  stepBlock: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 12,
  },
  stepConnector: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 36,
    flexShrink: 0,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    color: '#fff',
    flexShrink: 0,
  },
  stepLine: {
    width: 2,
    flex: 1,
    background: 'var(--border)',
    minHeight: 24,
  },
  stepContent: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 8,
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text)' },
  stepType: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' },
  label: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' },
  input: {
    width: '100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: 8,
  },
  textarea: { minHeight: 70, resize: 'vertical', fontFamily: 'inherit' },
  addStepRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    padding: '10px 0',
  },
  typeChip: {
    padding: '5px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'background 0.15s',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: 4,
    fontSize: 12,
  },
};

/* ── Employee multiselect for approver picker ── */
function EmployeeMultiSelect({ selected, onChange }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query || query.trim().length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => {
      setLoading(true);
      adminSearchEmployees(query.trim())
        .then(r => { setResults(r.employees || []); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const add = (emp) => {
    if (!selected.find(x => x.email === emp.email)) onChange([...selected, emp]);
    setQuery(''); setResults([]); setOpen(false);
  };
  const remove = (email) => onChange(selected.filter(x => x.email !== email));

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected tags */}
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
          {selected.map(emp => (
            <span key={emp.email} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: 'rgba(29,118,188,0.12)', color: '#1D76BC',
              border: '1px solid rgba(29,118,188,0.3)',
              borderRadius: 20, padding: '3px 8px 3px 10px', fontSize: 12, fontWeight: 600,
            }}>
              {emp.name}
              <button onClick={() => remove(emp.email)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#1D76BC', padding: 0, fontSize: 12, lineHeight: 1,
              }}>×</button>
            </span>
          ))}
        </div>
      )}
      {/* Search input */}
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...s.input, marginBottom: 0, paddingRight: 28 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {loading && (
          <i className="fas fa-spinner fa-spin" style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', fontSize: 11,
          }} />
        )}
      </div>
      {/* Dropdown */}
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 7, boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
          maxHeight: 220, overflowY: 'auto', marginTop: 2,
        }}>
          {results.map(emp => (
            <div key={emp.email} onMouseDown={() => add(emp)} style={{
              padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
              display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, alignItems: 'center',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{emp.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.email}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
                {emp.department && <div>{emp.department}</div>}
                {emp.designation && <div style={{ fontStyle: 'italic' }}>{emp.designation}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepEditor({ step, index, onChange, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown, formFields }) {
  const st = STEP_TYPE_MAP[step.type] || { label: step.type, icon: 'fa-cog', color: '#888' };
  const cfg = step.config || {};
  const upCfg = (key, val) => onChange(index, { ...step, config: { ...cfg, [key]: val } });

  return (
    <div style={s.stepBlock}>
      <div style={s.stepConnector}>
        <div style={{ ...s.stepCircle, background: st.color }}>
          <i className={`fas ${st.icon}`} />
        </div>
        <div style={s.stepLine} />
      </div>

      <div style={{ ...s.stepContent, flex: 1 }}>
        <div style={s.stepHeader}>
          <div>
            <div style={s.stepLabel}>{step.name || st.label}</div>
            <div style={s.stepType}>{step.type}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {canMoveUp && (
              <button style={s.iconBtn} onClick={() => onMoveUp(index)} title="Move up">
                <i className="fas fa-arrow-up" />
              </button>
            )}
            {canMoveDown && (
              <button style={s.iconBtn} onClick={() => onMoveDown(index)} title="Move down">
                <i className="fas fa-arrow-down" />
              </button>
            )}
            <button style={{ ...s.iconBtn, color: 'var(--error)' }} onClick={() => onRemove(index)}>
              <i className="fas fa-trash" />
            </button>
          </div>
        </div>

        {/* Step name */}
        <div>
          <label style={s.label}>Step Name</label>
          <input
            style={s.input}
            value={step.name || ''}
            placeholder={st.label}
            onChange={e => onChange(index, { ...step, name: e.target.value })}
          />
        </div>

        {/* Type-specific config */}
        {step.type === 'approval' && (
          <>
            {/* Mode toggle */}
            <label style={s.label}>Approver Type</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[
                { value: 'static',  label: 'Select People' },
                { value: 'dynamic', label: 'From Form Field' },
              ].map(opt => {
                const active = (cfg.approver_mode || 'static') === opt.value;
                return (
                  <button key={opt.value} onClick={() => upCfg('approver_mode', opt.value)} style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    border: `2px solid ${active ? '#1D76BC' : 'var(--border)'}`,
                    background: active ? 'rgba(29,118,188,0.12)' : 'transparent',
                    color: active ? '#1D76BC' : 'var(--text-muted)', cursor: 'pointer',
                  }}>
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {(cfg.approver_mode || 'static') === 'static' ? (
              <>
                <label style={s.label}>Approvers</label>
                <EmployeeMultiSelect
                  selected={cfg.approvers || []}
                  onChange={val => upCfg('approvers', val)}
                />
                {(cfg.approvers || []).length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Search and select one or more employees who can approve this step.
                  </div>
                )}
              </>
            ) : (
              <>
                <label style={s.label}>Form Field Containing Approver Email</label>
                <select
                  style={{ ...s.input, cursor: 'pointer' }}
                  value={cfg.approver_field || ''}
                  onChange={e => upCfg('approver_field', e.target.value)}
                >
                  <option value="">— pick a field —</option>
                  {(formFields || [])
                    .filter(f => ['email', 'text'].includes(f.field_type))
                    .map(f => (
                      <option key={f.name} value={f.name}>{f.label} ({f.name})</option>
                    ))}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4, marginBottom: 8 }}>
                  The approver will be whoever's email the submitter enters in this field.
                </div>
              </>
            )}

            <label style={s.label}>Approval Message</label>
            <input style={s.input} value={cfg.message || ''} placeholder="Please review and approve this request"
              onChange={e => upCfg('message', e.target.value)} />
          </>
        )}

        {step.type === 'email' && (
          <>
            <label style={s.label}>To (supports {`{{field_name}}`})</label>
            <input style={s.input} value={cfg.to || ''} placeholder="{{submitted_by_email}}"
              onChange={e => upCfg('to', e.target.value)} />
            <label style={s.label}>Subject</label>
            <input style={s.input} value={cfg.subject || ''} placeholder="New submission: {{form_name}}"
              onChange={e => upCfg('subject', e.target.value)} />
            <label style={s.label}>Body (HTML supported)</label>
            <textarea style={{ ...s.input, ...s.textarea }} value={cfg.body || ''}
              onChange={e => upCfg('body', e.target.value)} />
          </>
        )}

        {(step.type === 'webhook' || step.type === 'api_call') && (
          <>
            {step.type === 'api_call' && (
              <>
                <label style={s.label}>HTTP Method</label>
                <select style={{ ...s.input, cursor: 'pointer' }} value={cfg.method || 'POST'}
                  onChange={e => upCfg('method', e.target.value)}>
                  {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
                </select>
              </>
            )}
            <label style={s.label}>URL</label>
            <input style={s.input} value={cfg.url || ''} placeholder="https://example.com/api/hook"
              onChange={e => upCfg('url', e.target.value)} />
            <label style={s.label}>Include submission context in payload</label>
            <input type="checkbox" checked={!!cfg.include_context}
              onChange={e => upCfg('include_context', e.target.checked)} />
          </>
        )}

        {step.type === 'condition' && (
          <>
            <label style={s.label}>Expression (e.g. "status eq approved")</label>
            <input style={s.input} value={cfg.expression || ''}
              placeholder="priority eq high AND department eq HR"
              onChange={e => upCfg('expression', e.target.value)} />
            <label style={s.label}>On True: continue to next step (default)</label>
            <label style={s.label}>On False: stop workflow</label>
          </>
        )}

        {step.type === 'notification' && (
          <>
            <label style={s.label}>Message (supports {`{{field_name}}`})</label>
            <input style={s.input} value={cfg.message || ''} placeholder="Your request has been processed."
              onChange={e => upCfg('message', e.target.value)} />
          </>
        )}

        {step.type === 'delay' && (
          <>
            <label style={s.label}>Delay (seconds)</label>
            <input type="number" style={s.input} value={cfg.delay_seconds || 60} min={1}
              onChange={e => upCfg('delay_seconds', parseInt(e.target.value) || 60)} />
          </>
        )}

        {/* On failure */}
        <label style={s.label}>On Failure</label>
        <select style={{ ...s.input, cursor: 'pointer' }} value={step.on_failure || 'stop'}
          onChange={e => onChange(index, { ...step, on_failure: e.target.value })}>
          <option value="stop">Stop workflow</option>
          <option value="continue">Continue to next step</option>
        </select>
      </div>
    </div>
  );
}

function WorkflowEditor({ workflow, formId, onSave, onCancel, formFields }) {
  const [name, setName]         = useState(workflow?.name || '');
  const [trigger, setTrigger]   = useState(workflow?.trigger_event || 'on_submit');
  const [steps, setSteps]       = useState(workflow?.steps || []);
  const [saving, setSaving]     = useState(false);

  const addStep = (type) => {
    setSteps(prev => [...prev, { id: `s${Date.now()}`, type, name: '', config: {}, on_failure: 'stop' }]);
  };

  const updateStep = (idx, updated) => setSteps(prev => prev.map((s, i) => i === idx ? updated : s));
  const removeStep = (idx) => setSteps(prev => prev.filter((_, i) => i !== idx));

  const moveUp = (idx) => {
    if (idx === 0) return;
    setSteps(prev => {
      const s = [...prev];
      [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]];
      return s;
    });
  };

  const moveDown = (idx) => {
    setSteps(prev => {
      if (idx >= prev.length - 1) return prev;
      const s = [...prev];
      [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
      return s;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = { form_id: formId, name, trigger_event: trigger, steps };
      if (workflow?.id) {
        await adminUpdateWorkflow(workflow.id, body);
      } else {
        await adminCreateWorkflow(body);
      }
      onSave();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.title}>{workflow?.id ? 'Edit Workflow' : 'New Workflow'}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={onCancel}>Cancel</button>
          <button style={{ ...s.btn, ...s.primaryBtn }} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : <><i className="fas fa-save" /> Save</>}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={s.label}>Workflow Name</label>
        <input style={s.input} value={name} placeholder="On Submit — Approval Flow"
          onChange={e => setName(e.target.value)} />
        <label style={s.label}>Trigger</label>
        <select style={{ ...s.input, cursor: 'pointer' }} value={trigger}
          onChange={e => setTrigger(e.target.value)}>
          <option value="on_submit">On Form Submit</option>
          <option value="on_status_change">On Status Change</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
        Steps ({steps.length})
      </div>

      <div style={s.stepChain}>
        {steps.map((step, i) => (
          <StepEditor
            key={step.id || i}
            step={step}
            index={i}
            onChange={updateStep}
            onRemove={removeStep}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            canMoveUp={i > 0}
            canMoveDown={i < steps.length - 1}
            formFields={formFields}
          />
        ))}
      </div>

      <div style={s.addStepRow}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Add step:</span>
        {STEP_TYPES.map(st => (
          <button
            key={st.type}
            style={s.typeChip}
            onClick={() => addStep(st.type)}
          >
            <i className={`fas ${st.icon}`} style={{ color: st.color }} />
            {st.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WorkflowDesigner({ formId }) {
  const [workflows, setWorkflows]   = useState([]);
  const [editing, setEditing]       = useState(null); // null | {} | {id, ...}
  const [loading, setLoading]       = useState(true);
  const [formFields, setFormFields] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [wfData, formData] = await Promise.all([
        adminListWorkflows({ form_id: formId }),
        adminGetForm(formId).catch(() => null),
      ]);
      setWorkflows(wfData.items || []);
      setFormFields(formData?.fields || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [formId]);

  const handleDelete = async (wfId) => {
    if (!window.confirm('Delete this workflow?')) return;
    await adminDeleteWorkflow(wfId);
    load();
  };

  if (editing !== null) {
    return (
      <WorkflowEditor
        workflow={editing.id ? editing : null}
        formId={formId}
        formFields={formFields}
        onSave={() => { setEditing(null); load(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'rgba(15,118,110,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#0F766E', fontSize: 15,
            }}>
              <i className="fas fa-diagram-project" />
            </div>
            <div style={{ ...s.title, marginBottom: 0 }}>Automation</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 42 }}>
            Define automated workflows that run when this form is submitted
          </div>
        </div>
        <button style={{ ...s.btn, ...s.primaryBtn }} onClick={() => setEditing({})}>
          <i className="fas fa-plus" /> New Workflow
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Loading…
        </div>
      ) : workflows.length === 0 ? (
        <div style={{
          padding: '60px 40px', textAlign: 'center', color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', border: '2px dashed var(--border)',
          borderRadius: 12, marginTop: 8,
        }}>
          <i className="fas fa-diagram-project" style={{ fontSize: 36, marginBottom: 14, color: 'var(--border)' }} />
          <div style={{ fontSize: 16, marginBottom: 6, fontWeight: 700, color: 'var(--text)' }}>
            No automations yet
          </div>
          <div style={{ fontSize: 13, marginBottom: 20, lineHeight: 1.6, maxWidth: 360, margin: '0 auto 20px' }}>
            Automations run automatically when a form is submitted. Add approval flows, send emails, call webhooks, and more.
          </div>
          <button
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
            onClick={() => setEditing({})}
          >
            <i className="fas fa-plus" style={{ marginRight: 7 }} />Create First Automation
          </button>
        </div>
      ) : (
        workflows.map(wf => (
          <div key={wf.id} style={{ ...s.card, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{wf.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {wf.trigger_event} · {(wf.steps || []).length} step{wf.steps?.length !== 1 ? 's' : ''}
                  · <span style={{ color: wf.status === 'active' ? 'var(--success)' : 'var(--text-muted)' }}>{wf.status}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btn} onClick={() => setEditing(wf)}>
                  <i className="fas fa-edit" /> Edit
                </button>
                <button
                  style={{ ...s.btn, color: 'var(--error)', borderColor: 'var(--error)' }}
                  onClick={() => handleDelete(wf.id)}
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
