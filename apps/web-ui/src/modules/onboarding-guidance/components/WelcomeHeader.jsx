import React from 'react';

const WelcomeHeader = ({ user, overallProgress, completedCount, totalCount, pendingDocs }) => {
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <div className="og-welcome-card">
      <div className="og-welcome-glow" />

      <div className="og-welcome-left">
        <div className="og-welcome-greeting">
          Welcome, {firstName}! <span className="og-welcome-wave">👋</span>
        </div>
        <p className="og-welcome-sub">
          Your onboarding journey is underway — keep the momentum going.
        </p>

        <div className="og-welcome-progress">
          <div className="og-progress-label-row">
            <span className="og-progress-title">Overall Progress</span>
            <span className="og-progress-pct">{overallProgress}%</span>
          </div>
          <div className="og-progress-track">
            <div
              className="og-progress-fill"
              style={{ width: `${overallProgress}%` }}
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="og-progress-hint">
            {completedCount} of {totalCount} checklist items complete
          </p>
        </div>
      </div>

      <div className="og-welcome-stats">
        <div className="og-welcome-stat">
          <div className="og-welcome-stat-value" style={{ color: 'var(--light-blue)' }}>
            {overallProgress}%
          </div>
          <div className="og-welcome-stat-label">Checklist Done</div>
        </div>
        <div className="og-welcome-stat-divider" />
        <div className="og-welcome-stat">
          <div className="og-welcome-stat-value" style={{ color: 'var(--warning)' }}>
            {pendingDocs}
          </div>
          <div className="og-welcome-stat-label">Docs Pending</div>
        </div>
        <div className="og-welcome-stat-divider" />
        <div className="og-welcome-stat">
          <div className="og-welcome-stat-value" style={{ color: 'var(--secondary)' }}>
            9
          </div>
          <div className="og-welcome-stat-label">Days Since Join</div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeHeader;
