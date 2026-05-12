import React from 'react';
import { CHECKLIST_CATEGORIES } from '../constants/onboardingData';

const CATEGORY_COLORS = {
  documents: { bg: 'rgba(29,118,188,0.14)', color: 'var(--light-blue)'  },
  it:        { bg: 'rgba(39,170,225,0.14)', color: '#27AAE1'             },
  hr:        { bg: 'rgba(78,212,78,0.12)',  color: 'var(--secondary)'   },
  personal:  { bg: 'rgba(245,158,11,0.14)', color: 'var(--warning)'     },
};

const ChecklistPanel = ({
  filteredChecklist,
  checklistFilter,
  setChecklistFilter,
  searchQuery,
  setSearchQuery,
  toggleChecklistItem,
  completedCount,
  totalCount,
}) => {
  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-clipboard-check" />
          Employee Checklist
        </span>
        <span className="og-checklist-counter">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Search */}
      <div className="og-checklist-search-wrap">
        <i className="fas fa-search og-checklist-search-icon" />
        <input
          type="text"
          className="og-checklist-search"
          placeholder="Search checklist items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search checklist items"
        />
      </div>

      {/* Category filters */}
      <div className="og-checklist-filters">
        {CHECKLIST_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`og-filter-chip ${checklistFilter === cat ? 'active' : ''}`}
            onClick={() => setChecklistFilter(cat)}
          >
            {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="og-checklist-list">
        {filteredChecklist.length === 0 ? (
          <div className="og-empty-state">
            <i className="fas fa-search" style={{ fontSize: 28, opacity: 0.3 }} />
            <p>No items match your search.</p>
          </div>
        ) : (
          filteredChecklist.map(item => {
            const catStyle = CATEGORY_COLORS[item.category] || {};
            return (
              <div
                key={item.id}
                className={`og-checklist-item ${item.completed ? 'completed' : ''}`}
                onClick={() => toggleChecklistItem(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toggleChecklistItem(item.id)}
                aria-label={`${item.completed ? 'Uncheck' : 'Check'}: ${item.label}`}
              >
                <div className={`og-check-box ${item.completed ? 'checked' : ''}`}>
                  {item.completed && <i className="fas fa-check" />}
                </div>
                <span className="og-checklist-label">{item.label}</span>
                <span
                  className="og-checklist-cat"
                  style={{ background: catStyle.bg, color: catStyle.color }}
                >
                  {item.category}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChecklistPanel;
