import React from 'react';
import { IT_TOOLS } from '../../constants/onboardingData';

const STATUS_CONFIG = {
  'completed':     { label: 'Completed',     icon: 'fa-check-circle',   cls: 'og-tool-badge-done'    },
  'action-needed': { label: 'Action needed', icon: 'fa-info-circle',    cls: 'og-tool-badge-action'  },
  'in-progress':   { label: 'In progress',   icon: 'fa-clock',          cls: 'og-tool-badge-progress'},
};

const ITAccessStep = () => {
  const provisioned  = IT_TOOLS.filter(t => t.status === 'completed').length;
  const actionNeeded = IT_TOOLS.filter(t => t.status === 'action-needed').length;

  return (
    <div className="og-step-content">
      <div className="og-step-header">
        <div className="og-step-header-top">
          <div>
            <h2 className="og-step-title">IT access &amp; credentials</h2>
            <p className="og-step-subtitle">
              We've started provisioning your tools. Complete the action items below before your start date.
            </p>
          </div>

          <div className="og-step-stat-group">
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Provisioned</div>
              <div className="og-step-stat-value">{provisioned}/{IT_TOOLS.length}</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">ETA</div>
              <div className="og-step-stat-value">2 days</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">IT contact</div>
              <div className="og-step-stat-value" style={{ fontSize: 12 }}>it@aligned.com</div>
            </div>
          </div>
        </div>
      </div>

      {actionNeeded > 0 && (
        <div className="og-alert-banner">
          <i className="fas fa-exclamation-triangle" />
          <span>{actionNeeded} item{actionNeeded > 1 ? 's' : ''} require your attention before day one.</span>
        </div>
      )}

      <div className="og-tools-grid">
        {IT_TOOLS.map(tool => {
          const statusCfg = STATUS_CONFIG[tool.status] || STATUS_CONFIG['in-progress'];
          return (
            <div key={tool.id} className={`og-tool-card ${tool.status === 'action-needed' ? 'needs-action' : ''}`}>
              <div className="og-tool-card-header">
                <div className="og-tool-card-icon">
                  <i className={`fas ${tool.icon}`} />
                </div>
                <span className={`og-tool-badge ${statusCfg.cls}`}>
                  <i className={`fas ${statusCfg.icon}`} />
                  {statusCfg.label}
                </span>
              </div>

              <div className="og-tool-card-title">{tool.title}</div>
              <div className="og-tool-card-desc">{tool.description}</div>
              <div className="og-tool-card-detail">{tool.detail}</div>

              {tool.action && (
                <button className="og-tool-action-btn">
                  {tool.action}
                  <i className="fas fa-arrow-right" style={{ marginLeft: 6, fontSize: 10 }} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ITAccessStep;
