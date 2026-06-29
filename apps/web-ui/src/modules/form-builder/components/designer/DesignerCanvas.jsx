import React, { useState, useRef } from 'react';
import { FIELD_TYPE_MAP, LAYOUT_TYPES } from '../../constants/fieldTypes';

const s = {
  canvas: {
    flex: 1,
    overflow: 'auto',
    minHeight: 0,
    padding: '24px 32px',
    background: 'var(--bg)',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '80px 40px',
    border: '2px dashed var(--border)',
    borderRadius: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 32, color: 'var(--primary)', opacity: 0.5 },
  fieldCard: {
    position: 'relative',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '12px 16px',
    marginBottom: 8,
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  fieldCardSelected: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 2px rgba(29,118,188,0.2)',
  },
  fieldCardDragging: { opacity: 0.4 },
  dropZone: {
    height: 4,
    borderRadius: 2,
    margin: '2px 0',
    transition: 'height 0.15s, background 0.15s',
  },
  dropZoneActive: {
    height: 28,
    background: 'rgba(29,118,188,0.12)',
    border: '2px dashed var(--primary)',
    borderRadius: 8,
  },
  fieldHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  fieldTypeIcon: { fontSize: 12, color: 'var(--primary)', width: 16, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 },
  fieldName: { fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' },
  requiredBadge: {
    fontSize: 10,
    color: 'var(--error)',
    fontWeight: 700,
    marginLeft: 4,
  },
  fieldActions: {
    position: 'absolute',
    top: 8,
    right: 10,
    display: 'flex',
    gap: 4,
  },
  actionBtn: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    width: 26,
    height: 26,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: 11,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  },
  widthBadge: {
    fontSize: 10,
    color: 'var(--text-muted)',
    background: 'var(--bg-elevated)',
    borderRadius: 4,
    padding: '1px 6px',
  },
  layoutField: {
    borderStyle: 'dashed',
    opacity: 0.8,
  },
  sectionBlock: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    background: 'var(--bg-elevated)',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: '1px solid var(--border)',
  },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 },
  sectionBody: { padding: '12px' },
};

function DropZone({ index, onDrop }) {
  const [active, setActive] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setActive(true);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    const fieldType = e.dataTransfer.getData('application/ncl-field-type');
    const fromIndex = e.dataTransfer.getData('application/ncl-field-index');
    if (fieldType) onDrop({ type: 'new', fieldType, toIndex: index });
    else if (fromIndex !== '') onDrop({ type: 'move', fromIndex: parseInt(fromIndex), toIndex: index });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      style={{ ...s.dropZone, ...(active ? s.dropZoneActive : {}) }}
    />
  );
}

function FieldCard({ field, index, isSelected, onSelect, onRemove, onDuplicate, onDragStart }) {
  const ft = FIELD_TYPE_MAP[field.field_type] || { icon: 'fa-question', label: field.field_type };
  const isLayout = LAYOUT_TYPES.includes(field.field_type);

  const handleDragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/ncl-field-index', String(index));
    onDragStart?.();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={() => onSelect(field.id)}
      style={{
        ...s.fieldCard,
        ...(isSelected ? s.fieldCardSelected : {}),
        ...(isLayout ? s.layoutField : {}),
      }}
    >
      <div style={s.fieldHeader}>
        <span style={s.fieldTypeIcon}><i className={`fas ${ft.icon}`} /></span>
        <span style={s.fieldLabel}>
          {field.label}
          {field.required && <span style={s.requiredBadge}>*</span>}
        </span>
        {field.width !== 'full' && (
          <span style={s.widthBadge}>{field.width}</span>
        )}
        <span style={s.fieldName}>{field.name}</span>
      </div>

      {/* Field-type preview */}
      {!isLayout && (
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', opacity: 0.6 }} />
      )}
      {isLayout && field.field_type === 'heading' && (
        <div style={{ height: 18, width: '60%', borderRadius: 3, background: 'var(--border)', opacity: 0.4 }} />
      )}
      {isLayout && field.field_type === 'divider' && (
        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
      )}

      {/* Action buttons — visible on hover / selected */}
      {isSelected && (
        <div style={s.fieldActions}>
          <button
            style={s.actionBtn}
            title="Duplicate"
            onClick={e => { e.stopPropagation(); onDuplicate(field.id); }}
          >
            <i className="fas fa-copy" />
          </button>
          <button
            style={{ ...s.actionBtn, color: 'var(--error)' }}
            title="Remove"
            onClick={e => { e.stopPropagation(); onRemove(field.id); }}
          >
            <i className="fas fa-trash" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DesignerCanvas({
  fields, sections, selectedFieldId,
  onSelectField, onAddField, onMoveField,
  onRemoveField, onDuplicateField,
}) {
  const [draggingIndex, setDraggingIndex] = useState(null);

  const handleDrop = ({ type, fieldType, fromIndex, toIndex }) => {
    if (type === 'new') {
      onAddField(fieldType, null, toIndex > 0 ? toIndex - 1 : null);
    } else if (type === 'move' && fromIndex !== toIndex) {
      onMoveField(fromIndex, toIndex > fromIndex ? toIndex - 1 : toIndex);
    }
    setDraggingIndex(null);
  };

  // Unsectioned fields
  const unsectioned = fields.filter(f => !f.section_id || !sections.find(s => s.id === f.section_id));

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div
      style={s.canvas}
      onDragOver={handleCanvasDragOver}
      onDrop={e => {
        const ft = e.dataTransfer.getData('application/ncl-field-type');
        if (ft) {
          e.preventDefault();
          onAddField(ft, null, null);
        }
      }}
    >
      {/* Sections */}
      {sections.map(sec => {
        const secFields = fields.filter(f => f.section_id === sec.id).sort((a, b) => a.order_index - b.order_index);
        return (
          <div key={sec.id} style={s.sectionBlock}>
            <div style={s.sectionHeader}>
              <i className="fas fa-layer-group" style={{ fontSize: 12, color: 'var(--primary)' }} />
              <span style={s.sectionTitle}>{sec.title || 'Untitled Section'}</span>
            </div>
            <div style={s.sectionBody}>
              {secFields.map((field, idx) => (
                <React.Fragment key={field.id}>
                  <DropZone index={idx} onDrop={handleDrop} />
                  <FieldCard
                    field={field}
                    index={fields.indexOf(field)}
                    isSelected={field.id === selectedFieldId}
                    onSelect={onSelectField}
                    onRemove={onRemoveField}
                    onDuplicate={onDuplicateField}
                    onDragStart={() => setDraggingIndex(fields.indexOf(field))}
                  />
                </React.Fragment>
              ))}
              <DropZone index={secFields.length} onDrop={handleDrop} />
            </div>
          </div>
        );
      })}

      {/* Unsectioned fields */}
      {fields.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}><i className="fas fa-hand-pointer" /></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            Drag fields here to start building
          </div>
          <div style={{ fontSize: 13 }}>
            Pick from the palette on the left
          </div>
        </div>
      ) : (
        unsectioned.map((field, idx) => (
          <React.Fragment key={field.id}>
            <DropZone index={idx} onDrop={handleDrop} />
            <FieldCard
              field={field}
              index={fields.indexOf(field)}
              isSelected={field.id === selectedFieldId}
              onSelect={onSelectField}
              onRemove={onRemoveField}
              onDuplicate={onDuplicateField}
              onDragStart={() => setDraggingIndex(fields.indexOf(field))}
            />
          </React.Fragment>
        ))
      )}
      {unsectioned.length > 0 && (
        <DropZone index={unsectioned.length} onDrop={handleDrop} />
      )}
    </div>
  );
}
