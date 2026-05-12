import React from 'react';

const WelcomeStep = ({ user, onNext }) => {
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  return (
    <div className="og-step-content">
      <div className="og-welcome-chip">
        <i className="fas fa-star" />
        Welcome aboard, {firstName}
      </div>

      <h1 className="og-welcome-main-title">
        Welcome to<br />
        <span className="og-welcome-company">Aligned Automation</span>
      </h1>

      <p className="og-welcome-body">
        Let's set up your workspace and get you ready for your journey.
        Work through each step at your own pace — everything is saved automatically.
      </p>

      <div className="og-welcome-meta-cards">
        <div className="og-welcome-meta-card">
          <i className="fas fa-calendar-check" />
          <div>
            <div className="og-welcome-meta-label">Start Date</div>
            <div className="og-welcome-meta-value">28 Apr 2026</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-user-tie" />
          <div>
            <div className="og-welcome-meta-label">Your Manager</div>
            <div className="og-welcome-meta-value">Rajesh Kumar</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-users" />
          <div>
            <div className="og-welcome-meta-label">Team</div>
            <div className="og-welcome-meta-value">Engineering · Pod 3</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-map-marker-alt" />
          <div>
            <div className="og-welcome-meta-label">Location</div>
            <div className="og-welcome-meta-value">Mumbai Office / Remote</div>
          </div>
        </div>
      </div>

      <div className="og-welcome-team-row">
        <div className="og-welcome-team-avatars">
          {['RK', 'SM', 'PS', 'ML', 'KS'].map((init, i) => (
            <div
              key={i}
              className="og-welcome-team-avatar"
              style={{ marginLeft: i > 0 ? -10 : 0, zIndex: 5 - i }}
            >
              {init}
            </div>
          ))}
        </div>
        <div className="og-welcome-team-text">
          Your team is excited to meet you · <strong>5 colleagues in Engineering</strong>
        </div>
      </div>

      <button className="og-start-btn" onClick={onNext}>
        Start Onboarding
        <i className="fas fa-arrow-right" />
      </button>
    </div>
  );
};

export default WelcomeStep;
