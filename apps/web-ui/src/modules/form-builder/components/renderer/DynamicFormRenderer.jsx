import React from 'react';
import FormField from './FormField';
import { useFormRenderer } from '../../hooks/useFormRenderer';
import { submitForm } from '../../services/formBuilderApi';

const s = {
  wrapper: {
    maxWidth: 720,
    margin: '0 auto',
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    padding: '32px 40px',
    border: '1px solid var(--border)',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 6,
  },
  desc: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 28,
    lineHeight: 1.6,
  },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 0,
  },
  sectionBlock: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 4,
    paddingBottom: 8,
    borderBottom: '1px solid var(--border)',
  },
  sectionDesc: {
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 16,
  },
  formError: {
    padding: '12px 16px',
    background: 'rgba(240,82,82,0.1)',
    border: '1px solid var(--error)',
    borderRadius: 8,
    color: 'var(--error)',
    fontSize: 13,
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 28,
    paddingTop: 20,
    borderTop: '1px solid var(--border)',
  },
  submitBtn: {
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 28px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  success: {
    textAlign: 'center',
    padding: '60px 40px',
  },
  successIcon: {
    fontSize: 48,
    color: 'var(--success)',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8,
  },
  successMsg: {
    fontSize: 14,
    color: 'var(--text-secondary)',
  },
};

function getWidthStyle(width) {
  switch (width) {
    case 'half':    return { flex: '1 1 calc(50% - 8px)', minWidth: 200 };
    case 'third':   return { flex: '1 1 calc(33% - 11px)', minWidth: 150 };
    case 'quarter': return { flex: '1 1 calc(25% - 12px)', minWidth: 120 };
    default:        return { flex: '1 1 100%' };
  }
}

function groupFieldsIntoRows(fields) {
  const rows = [];
  let currentRow = [];

  for (const field of fields) {
    if (field.width === 'full' || field.width === undefined) {
      if (currentRow.length) { rows.push(currentRow); currentRow = []; }
      rows.push([field]);
    } else {
      currentRow.push(field);
      // Simple heuristic: flush row after 2+ half, 3+ third, 4+ quarter
      const slots = { half: 2, third: 3, quarter: 4 };
      if (currentRow.length >= (slots[field.width] || 2)) {
        rows.push(currentRow); currentRow = [];
      }
    }
  }
  if (currentRow.length) rows.push(currentRow);
  return rows;
}

function FieldRows({ fields, values, errors, touched, fieldStates, onChange, onBlur }) {
  const visibleFields = fields.filter(f => fieldStates[f.id]?.visible !== false);
  const rows = groupFieldsIntoRows(visibleFields);

  return (
    <>
      {rows.map((row, ri) => (
        <div key={ri} style={row.length > 1 ? s.row : {}}>
          {row.map(field => (
            <div key={field.id} style={getWidthStyle(field.width)}>
              <FormField
                field={field}
                value={values[field.name]}
                error={errors[field.name]}
                touched={touched[field.name]}
                onChange={onChange}
                onBlur={onBlur}
              />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export default function DynamicFormRenderer({
  form,
  prefill = {},
  metadata = {},
  onSuccess,
  compact = false,
}) {
  const handleSubmit = async ({ data, metadata: meta }) => {
    await submitForm(form.slug, { form_id: form.id, data, metadata: { ...metadata, ...meta } });
  };

  const {
    values, errors, touched, fieldStates,
    submitting, submitted,
    notifications,
    setValue, touchField, handleSubmit: submit,
  } = useFormRenderer(form, prefill, handleSubmit);

  if (submitted) {
    const msg = form?.settings?.success_message || 'Thank you! Your response has been submitted.';
    return (
      <div style={compact ? {} : s.wrapper}>
        <div style={s.success}>
          <div style={s.successIcon}><i className="fas fa-check-circle" /></div>
          <div style={s.successTitle}>Submitted!</div>
          <div style={s.successMsg}>{msg}</div>
          {onSuccess && (
            <button
              style={{ ...s.submitBtn, marginTop: 20, background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={onSuccess}
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const sections = form?.sections || [];
  const allFields = form?.fields || [];

  // Unsectioned fields (no section_id or section not found)
  const sectionIds = new Set(sections.map(s => s.id));
  const unsectionedFields = allFields.filter(f => !f.section_id || !sectionIds.has(f.section_id));

  return (
    <div style={compact ? {} : s.wrapper}>
      {!compact && (
        <>
          <div style={s.title}>{form?.name}</div>
          {form?.description && <div style={s.desc}>{form.description}</div>}
        </>
      )}

      {errors._form && (
        <div style={s.formError}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: 6 }} />
          {errors._form}
        </div>
      )}

      {/* Rule engine notifications */}
      {(notifications || []).map((n, i) => (
        <div key={i} style={{
          padding: '10px 14px',
          borderRadius: 7,
          fontSize: 13,
          marginBottom: 12,
          background: n.level === 'error'   ? 'rgba(240,82,82,0.1)'
                    : n.level === 'warning' ? 'rgba(245,158,11,0.1)'
                    : 'rgba(29,118,188,0.1)',
          border: `1px solid ${
            n.level === 'error'   ? 'var(--error)'
            : n.level === 'warning' ? 'var(--warning)'
            : 'var(--primary)'
          }`,
          color: n.level === 'error'   ? 'var(--error)'
               : n.level === 'warning' ? 'var(--warning)'
               : 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <i className={`fas ${
            n.level === 'error'   ? 'fa-times-circle'
            : n.level === 'warning' ? 'fa-exclamation-triangle'
            : 'fa-info-circle'
          }`} />
          {n.message}
        </div>
      ))}

      {/* Sections */}
      {sections.map(section => {
        const sFields = allFields
          .filter(f => f.section_id === section.id)
          .sort((a, b) => a.order_index - b.order_index);
        if (!sFields.length) return null;
        return (
          <div key={section.id} style={s.sectionBlock}>
            {section.title && <div style={s.sectionTitle}>{section.title}</div>}
            {section.description && <div style={s.sectionDesc}>{section.description}</div>}
            <FieldRows
              fields={sFields}
              values={values}
              errors={errors}
              touched={touched}
              fieldStates={fieldStates}
              onChange={setValue}
              onBlur={touchField}
            />
          </div>
        );
      })}

      {/* Unsectioned fields */}
      {unsectionedFields.length > 0 && (
        <FieldRows
          fields={unsectionedFields.sort((a, b) => a.order_index - b.order_index)}
          values={values}
          errors={errors}
          touched={touched}
          fieldStates={fieldStates}
          onChange={setValue}
          onBlur={touchField}
        />
      )}

      <div style={s.actions}>
        <button
          style={{
            ...s.submitBtn,
            ...(submitting ? s.submitBtnDisabled : {}),
          }}
          disabled={submitting}
          onClick={() => submit(metadata)}
        >
          {submitting
            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Submitting…</>
            : (form?.settings?.submit_label || 'Submit')}
        </button>
      </div>
    </div>
  );
}
