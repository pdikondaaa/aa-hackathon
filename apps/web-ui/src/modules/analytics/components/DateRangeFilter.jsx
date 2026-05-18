import React from 'react';
import { DATE_RANGE_OPTIONS } from '../constants/analyticsData';

export default function DateRangeFilter({ value, onChange }) {
  return (
    <div className="an-date-filter">
      {DATE_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          className={`an-date-btn${value === opt.id ? ' active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
