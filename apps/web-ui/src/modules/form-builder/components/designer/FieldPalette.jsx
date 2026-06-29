import React, { useState } from 'react';
import { FIELD_CATEGORIES, FIELD_TYPES } from '../../constants/fieldTypes';

const s = {
  palette: {
    width: 220,
    minWidth: 220,
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
  body: { overflow: 'auto', flex: 1, padding: '8px 0' },
  catLabel: {
    padding: '8px 16px 4px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: 'var(--text-muted)',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '7px 16px',
    cursor: 'grab',
    borderRadius: 6,
    margin: '1px 8px',
    transition: 'background 0.15s',
    userSelect: 'none',
  },
  icon: { width: 18, fontSize: 12, color: 'var(--primary)', textAlign: 'center' },
  label: { fontSize: 13, color: 'var(--text)' },
};

export default function FieldPalette({ onDragStart }) {
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = (e, fieldType) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/ncl-field-type', fieldType);
    onDragStart?.(fieldType);
  };

  return (
    <div style={s.palette}>
      <div style={s.header}>Fields</div>
      <div style={s.body}>
        {FIELD_CATEGORIES.map(cat => {
          const items = FIELD_TYPES.filter(f => f.category === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id}>
              <div style={s.catLabel}>{cat.label}</div>
              {items.map(ft => (
                <div
                  key={ft.type}
                  draggable
                  onDragStart={e => handleDragStart(e, ft.type)}
                  onMouseEnter={() => setDragOver(ft.type)}
                  onMouseLeave={() => setDragOver(null)}
                  style={{
                    ...s.item,
                    background: dragOver === ft.type ? 'var(--bg-elevated)' : 'transparent',
                  }}
                >
                  <span style={s.icon}><i className={`fas ${ft.icon}`} /></span>
                  <span style={s.label}>{ft.label}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
