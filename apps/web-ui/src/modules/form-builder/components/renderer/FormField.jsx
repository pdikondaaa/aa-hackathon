import React from 'react';

const baseInput = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};

const errorInput = { borderColor: 'var(--error)' };

const s = {
  wrapper: { marginBottom: 18 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 5,
  },
  required: { color: 'var(--error)', marginLeft: 3 },
  helpText: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
  error: { fontSize: 12, color: 'var(--error)', marginTop: 4 },
  input: baseInput,
  textarea: { ...baseInput, minHeight: 90, resize: 'vertical' },
  select: { ...baseInput, cursor: 'pointer' },
  radioGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  radioItem: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  radioLabel: { fontSize: 14, color: 'var(--text)', cursor: 'pointer' },
  checkGroup: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  checkLabel: { fontSize: 14, color: 'var(--text)', cursor: 'pointer' },
  starRow: { display: 'flex', gap: 4, marginTop: 4 },
  star: { fontSize: 24, cursor: 'pointer', transition: 'color 0.1s' },
  heading: { fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '8px 0 4px' },
  paragraph: { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '4px 0 8px' },
  divider: { border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' },
  toggleWrapper: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  fileInput: {
    width: '100%',
    padding: '8px 0',
    fontSize: 13,
    color: 'var(--text)',
    cursor: 'pointer',
  },
};

function RatingStars({ value, onChange, max = 5 }) {
  const [hover, setHover] = React.useState(0);
  const active = hover || Number(value) || 0;
  return (
    <div style={s.starRow}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <span
          key={n}
          style={{ ...s.star, color: n <= active ? '#f59e0b' : 'var(--border)' }}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
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
        left: checked ? 20 : 3,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
      }} />
    </div>
  );
}

export default function FormField({ field, value, error, touched, onChange, onBlur }) {
  const hasErr = touched && error;
  const inp = hasErr ? { ...baseInput, ...errorInput } : baseInput;

  const handleChange = (val) => onChange(field.name, val);
  const handleBlur = () => onBlur?.(field.name);

  // Layout / non-data fields
  if (field.field_type === 'heading') {
    return <div style={s.wrapper}><div style={s.heading}>{field.label}</div></div>;
  }
  if (field.field_type === 'paragraph') {
    return <div style={s.wrapper}><p style={s.paragraph}>{field.default_value || field.label}</p></div>;
  }
  if (field.field_type === 'divider') {
    return <div style={s.wrapper}><hr style={s.divider} /></div>;
  }

  const labelEl = (
    <label style={s.label}>
      {field.label}
      {field.required && <span style={s.required}>*</span>}
    </label>
  );

  let control;

  switch (field.field_type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'url':
      control = (
        <input
          type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
          style={inp}
          value={value || ''}
          placeholder={field.placeholder || ''}
          readOnly={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
      break;

    case 'number':
      control = (
        <input
          type="number"
          style={inp}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          readOnly={field.read_only}
          min={field.validation_rules?.min}
          max={field.validation_rules?.max}
          onChange={e => handleChange(e.target.value === '' ? '' : Number(e.target.value))}
          onBlur={handleBlur}
        />
      );
      break;

    case 'textarea':
      control = (
        <textarea
          style={hasErr ? { ...s.textarea, ...errorInput } : s.textarea}
          value={value || ''}
          placeholder={field.placeholder || ''}
          readOnly={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
      break;

    case 'date':
      control = (
        <input
          type="date"
          style={inp}
          value={value || ''}
          readOnly={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
      break;

    case 'datetime':
      control = (
        <input
          type="datetime-local"
          style={inp}
          value={value || ''}
          readOnly={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
      break;

    case 'time':
      control = (
        <input
          type="time"
          style={inp}
          value={value || ''}
          readOnly={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
      break;

    case 'dropdown':
      control = (
        <select
          style={hasErr ? { ...s.select, ...errorInput } : s.select}
          value={value || ''}
          disabled={field.read_only}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        >
          <option value="">{field.placeholder || 'Select an option…'}</option>
          {(field.options || []).map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
      break;

    case 'radio':
      control = (
        <div style={s.radioGroup}>
          {(field.options || []).map(opt => {
            const checked = value === opt.value;
            return (
              <label key={opt.value} style={s.radioItem}>
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={checked}
                  onChange={() => handleChange(opt.value)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={s.radioLabel}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
      break;

    case 'checkbox': {
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      control = (
        <div style={s.checkGroup}>
          {(field.options || []).map(opt => {
            const checked = selected.includes(opt.value);
            return (
              <label key={opt.value} style={s.checkItem}>
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter(v => v !== opt.value)
                      : [...selected, opt.value];
                    handleChange(next);
                  }}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span style={s.checkLabel}>{opt.label}</span>
              </label>
            );
          })}
        </div>
      );
      break;
    }

    case 'toggle':
      control = (
        <div style={s.toggleWrapper}>
          <ToggleSwitch
            checked={!!value}
            onChange={v => handleChange(v)}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      );
      break;

    case 'rating':
      control = (
        <RatingStars
          value={value}
          onChange={n => handleChange(n)}
        />
      );
      break;

    case 'slider': {
      const min = field.validation_rules?.min ?? 0;
      const max = field.validation_rules?.max ?? 100;
      control = (
        <div>
          <input
            type="range"
            min={min}
            max={max}
            value={value ?? min}
            onChange={e => handleChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            <span>{min}</span>
            <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{value ?? min}</span>
            <span>{max}</span>
          </div>
        </div>
      );
      break;
    }

    case 'file':
      control = (
        <input
          type="file"
          style={s.fileInput}
          onChange={e => handleChange(e.target.files[0]?.name || '')}
        />
      );
      break;

    case 'hidden':
      return null;

    default:
      control = (
        <input
          style={inp}
          value={value || ''}
          onChange={e => handleChange(e.target.value)}
          onBlur={handleBlur}
        />
      );
  }

  return (
    <div style={s.wrapper}>
      {labelEl}
      {control}
      {field.help_text && !hasErr && (
        <div style={s.helpText}>{field.help_text}</div>
      )}
      {hasErr && <div style={s.error}><i className="fas fa-exclamation-circle" style={{ marginRight: 4 }} />{error}</div>}
    </div>
  );
}
