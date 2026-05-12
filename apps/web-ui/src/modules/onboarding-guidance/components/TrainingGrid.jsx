import React from 'react';
import StatusBadge from './StatusBadge';
import { TRAINING_MODULES } from '../constants/onboardingData';

const TrainingGrid = () => {
  const completed    = TRAINING_MODULES.filter(m => m.status === 'completed').length;
  const inProgress   = TRAINING_MODULES.filter(m => m.status === 'in-progress').length;

  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-graduation-cap" />
          Training Status
        </span>
        <span className="og-checklist-counter">
          {completed}/{TRAINING_MODULES.length} done
          {inProgress > 0 && ` · ${inProgress} active`}
        </span>
      </div>

      <div className="og-training-grid">
        {TRAINING_MODULES.map((module) => (
          <div key={module.id} className="og-training-card" role="button" tabIndex={0}>
            <div className="og-training-top">
              <div
                className="og-training-icon"
                style={{ background: `${module.color}22`, color: module.color }}
              >
                <i className={`fas ${module.icon}`} />
              </div>
              <StatusBadge status={module.status} />
            </div>

            <div className="og-training-title">{module.title}</div>

            <div className="og-training-meta">
              <i className="fas fa-clock" style={{ marginRight: 4 }} />
              {module.duration}
              {module.completedDate && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>· {module.completedDate}</span>
              )}
            </div>

            {/* Progress bar */}
            {module.status !== 'not-started' && (
              <div className="og-training-progress-track">
                <div
                  className="og-training-progress-fill"
                  style={{
                    width: `${module.progress}%`,
                    background: module.status === 'completed'
                      ? 'var(--secondary)'
                      : module.color,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrainingGrid;
