import React, { useState } from 'react';
import {
  HAS_OPTIONS, HAS_FORMULA, WIDTH_OPTIONS,
  OPERATOR_OPTIONS, CONDITION_ACTIONS,
} from '../../constants/fieldTypes';

const s = {
  panel: {
    width: 280,
    minWidth: 280,
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border)',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: '14px 16px 10px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    borderBottom: '1px solid var(--border)',
  },
  empty: {
    padding: '40px 16px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 13,
  },
  section: { padding: '14px 16px', borderBottom: '1px solid var(--border-light)' },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 10,
  },
  field: { marginBottom: 12 },
  label: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' },
  input: {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    minHeight: 70,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleLabel: { fontSize: 13, color: 'var(--text)' },
  select: {
    width: '100%',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--text)',
    outline: 'none',
  },
  optionRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
    alignItems: 'center',
  },
  optionInput: {
    flex: 1,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    padding: '5px 8px',
    fontSize: 12,
    color: 'var(--text)',
    outline: 'none',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '4px 6px',
    fontSize: 12,
  },
  addBtn: {
    background: 'none',
    border: '1px dashed var(--border)',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--primary)',
    cursor: 'pointer',
    width: '100%',
    marginTop: 4,
  },
  conditionBlock: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  condRow: { display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' },
};

function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--primary)' : 'var(--border)',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        top: 3,
        left: checked ? 18 : 3,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

export default function PropertiesPanel({ field, fields, onUpdate }) {
  const [tab, setTab] = useState('basic');

  if (!field) {
    return (
      <div style={s.panel}>
        <div style={s.header}>Properties</div>
        <div style={s.empty}>
          <i className="fas fa-mouse-pointer" style={{ fontSize: 24, marginBottom: 10 }} />
          <p>Select a field to edit its properties</p>
        </div>
      </div>
    );
  }

  const up = (key, val) => onUpdate(field.id, { [key]: val });

  const tabs = [
    { id: 'basic',      label: 'Basic' },
    { id: 'validation', label: 'Rules' },
    { id: 'conditions', label: 'Logic' },
  ];

  return (
    <div style={s.panel}>
      <div style={s.header}>Properties — {field.label}</div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '9px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Label */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Identity</div>
            <div style={s.field}>
              <label style={s.label}>Label</label>
              <input
                style={s.input}
                value={field.label}
                onChange={e => up('label', e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Field Name (code key)</label>
              <input
                style={{ ...s.input, fontFamily: 'monospace', fontSize: 12 }}
                value={field.name}
                onChange={e => up('name', e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'))}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Placeholder</label>
              <input
                style={s.input}
                value={field.placeholder || ''}
                onChange={e => up('placeholder', e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Help Text</label>
              <input
                style={s.input}
                value={field.help_text || ''}
                onChange={e => up('help_text', e.target.value)}
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Default Value</label>
              <input
                style={s.input}
                value={field.default_value || ''}
                onChange={e => up('default_value', e.target.value)}
              />
            </div>
          </div>

          {/* Options for dropdown/radio/checkbox */}
          {HAS_OPTIONS.includes(field.field_type) && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Options</div>
              {(field.options || []).map((opt, i) => (
                <div key={i} style={s.optionRow}>
                  <input
                    style={s.optionInput}
                    placeholder="Label"
                    value={opt.label}
                    onChange={e => {
                      const opts = [...field.options];
                      opts[i] = { ...opts[i], label: e.target.value };
                      up('options', opts);
                    }}
                  />
                  <input
                    style={{ ...s.optionInput, maxWidth: 80, fontFamily: 'monospace', fontSize: 11 }}
                    placeholder="value"
                    value={opt.value}
                    onChange={e => {
                      const opts = [...field.options];
                      opts[i] = { ...opts[i], value: e.target.value };
                      up('options', opts);
                    }}
                  />
                  <button
                    style={s.iconBtn}
                    onClick={() => {
                      const opts = field.options.filter((_, j) => j !== i);
                      up('options', opts);
                    }}
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              ))}
              <button
                style={s.addBtn}
                onClick={() => up('options', [...(field.options || []), { label: '', value: '' }])}
              >
                + Add Option
              </button>
            </div>
          )}

          {/* Layout */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Layout</div>
            <div style={s.field}>
              <label style={s.label}>Width</label>
              <select
                style={s.select}
                value={field.width || 'full'}
                onChange={e => up('width', e.target.value)}
              >
                {WIDTH_OPTIONS.map(w => (
                  <option key={w.value} value={w.value}>{w.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Flags */}
          <div style={s.section}>
            <div style={s.sectionTitle}>Options</div>
            {[
              ['required',  'Required'],
              ['read_only', 'Read Only'],
              ['hidden',    'Hidden'],
            ].map(([key, lbl]) => (
              <div key={key} style={s.toggle}>
                <span style={s.toggleLabel}>{lbl}</span>
                <ToggleSwitch
                  checked={!!field[key]}
                  onChange={v => up(key, v)}
                />
              </div>
            ))}
          </div>

          {/* Formula */}
          {HAS_FORMULA.includes(field.field_type) && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Formula (calculated)</div>
              <div style={s.field}>
                <textarea
                  style={{ ...s.input, ...s.textarea }}
                  placeholder="e.g. qty * price"
                  value={field.formula || ''}
                  onChange={e => up('formula', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'validation' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
          <div style={s.sectionTitle}>Validation Rules</div>
          {['text', 'textarea', 'richtext', 'email', 'phone', 'url'].includes(field.field_type) && (
            <>
              <div style={s.field}>
                <label style={s.label}>Min Length</label>
                <input
                  type="number"
                  style={s.input}
                  value={field.validation_rules?.min_length || ''}
                  onChange={e => up('validation_rules', { ...field.validation_rules, min_length: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Max Length</label>
                <input
                  type="number"
                  style={s.input}
                  value={field.validation_rules?.max_length || ''}
                  onChange={e => up('validation_rules', { ...field.validation_rules, max_length: e.target.value ? parseInt(e.target.value) : undefined })}
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Regex Pattern</label>
                <input
                  style={{ ...s.input, fontFamily: 'monospace', fontSize: 12 }}
                  value={field.validation_rules?.pattern || ''}
                  onChange={e => up('validation_rules', { ...field.validation_rules, pattern: e.target.value })}
                />
              </div>
            </>
          )}
          {field.field_type === 'number' && (
            <>
              <div style={s.field}>
                <label style={s.label}>Min Value</label>
                <input
                  type="number"
                  style={s.input}
                  value={field.validation_rules?.min ?? ''}
                  onChange={e => up('validation_rules', { ...field.validation_rules, min: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Max Value</label>
                <input
                  type="number"
                  style={s.input}
                  value={field.validation_rules?.max ?? ''}
                  onChange={e => up('validation_rules', { ...field.validation_rules, max: e.target.value !== '' ? parseFloat(e.target.value) : undefined })}
                />
              </div>
            </>
          )}
          <div style={s.field}>
            <label style={s.label}>Custom Error Message</label>
            <input
              style={s.input}
              value={field.validation_rules?.custom_message || ''}
              onChange={e => up('validation_rules', { ...field.validation_rules, custom_message: e.target.value })}
            />
          </div>
        </div>
      )}

      {tab === 'conditions' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
          <div style={s.sectionTitle}>Conditional Logic</div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Control this field's visibility based on other field values.
          </p>
          {(field.conditional_logic || []).map((rule, i) => (
            <div key={i} style={s.conditionBlock}>
              <div style={s.condRow}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }}>When</span>
                <select
                  style={{ ...s.select, fontSize: 11 }}
                  value={rule.when?.field || ''}
                  onChange={e => {
                    const cl = [...field.conditional_logic];
                    cl[i] = { ...cl[i], when: { ...cl[i].when, field: e.target.value } };
                    up('conditional_logic', cl);
                  }}
                >
                  <option value="">Select field…</option>
                  {fields.filter(f => f.id !== field.id && !['heading','paragraph','divider'].includes(f.field_type)).map(f => (
                    <option key={f.id} value={f.name}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={s.condRow}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }} />
                <select
                  style={{ ...s.select, fontSize: 11 }}
                  value={rule.when?.op || 'eq'}
                  onChange={e => {
                    const cl = [...field.conditional_logic];
                    cl[i] = { ...cl[i], when: { ...cl[i].when, op: e.target.value } };
                    up('conditional_logic', cl);
                  }}
                >
                  {OPERATOR_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {!['empty', 'not_empty'].includes(rule.when?.op) && (
                <div style={s.condRow}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }} />
                  <input
                    style={{ ...s.optionInput, fontSize: 11 }}
                    placeholder="value"
                    value={rule.when?.value || ''}
                    onChange={e => {
                      const cl = [...field.conditional_logic];
                      cl[i] = { ...cl[i], when: { ...cl[i].when, value: e.target.value } };
                      up('conditional_logic', cl);
                    }}
                  />
                </div>
              )}
              <div style={s.condRow}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }}>Then</span>
                <select
                  style={{ ...s.select, fontSize: 11 }}
                  value={rule.then?.action || 'show'}
                  onChange={e => {
                    const cl = [...field.conditional_logic];
                    cl[i] = { ...cl[i], then: { ...cl[i].then, action: e.target.value } };
                    up('conditional_logic', cl);
                  }}
                >
                  {CONDITION_ACTIONS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
                <button
                  style={{ ...s.iconBtn, color: 'var(--error)' }}
                  onClick={() => {
                    const cl = field.conditional_logic.filter((_, j) => j !== i);
                    up('conditional_logic', cl);
                  }}
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}
          <button
            style={s.addBtn}
            onClick={() =>
              up('conditional_logic', [
                ...(field.conditional_logic || []),
                { when: { field: '', op: 'eq', value: '' }, then: { action: 'show' } },
              ])
            }
          >
            + Add Condition
          </button>
        </div>
      )}
    </div>
  );
}
