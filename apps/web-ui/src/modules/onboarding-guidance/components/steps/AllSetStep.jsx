import React from 'react';

const NEXT_STEPS = [
  { icon: 'fa-calendar-check', title: '30-Day Review',       desc: 'Scheduled with Rajesh Kumar on 28 May 2026',   color: '#1D76BC' },
  { icon: 'fa-users',          title: 'Team All-Hands',       desc: 'Engineering pod meetup — May 15, 10:00 AM',    color: '#27AAE1' },
  { icon: 'fa-graduation-cap', title: 'Complete Training',    desc: '3 training modules still pending completion',  color: '#4ED44E' },
  { icon: 'fa-trophy',         title: '90-Day Milestone',     desc: 'Performance check on 25 Jul 2026',             color: '#2A3D90' },
];

const AllSetStep = () => {
  return (
    <div className="og-step-content">
      <div className="og-all-set-hero">
        <div className="og-all-set-icon">
          <i className="fas fa-trophy" />
        </div>
        <h2 className="og-step-title" style={{ textAlign: 'center', marginTop: 16 }}>
          You're almost all set! 🎉
        </h2>
        <p className="og-step-subtitle" style={{ textAlign: 'center', maxWidth: 520, margin: '8px auto 0' }}>
          Great progress! Complete the remaining steps and you'll officially be part of the Aligned Automation family.
        </p>
      </div>

      {/* Summary cards */}
      <div className="og-allset-summary">
        <div className="og-allset-summary-card completed">
          <i className="fas fa-check-circle" />
          <div className="og-allset-summary-label">Completed</div>
          <div className="og-allset-summary-value">2</div>
        </div>
        <div className="og-allset-summary-card in-progress">
          <i className="fas fa-clock" />
          <div className="og-allset-summary-label">In Progress</div>
          <div className="og-allset-summary-value">1</div>
        </div>
        <div className="og-allset-summary-card pending">
          <i className="fas fa-circle" />
          <div className="og-allset-summary-label">Remaining</div>
          <div className="og-allset-summary-value">5</div>
        </div>
        <div className="og-allset-summary-card overall">
          <i className="fas fa-chart-pie" />
          <div className="og-allset-summary-label">Overall</div>
          <div className="og-allset-summary-value">25%</div>
        </div>
      </div>

      {/* What's next */}
      <div className="og-step-header" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>What's next</h3>
      </div>

      <div className="og-next-steps-list">
        {NEXT_STEPS.map((item, i) => (
          <div key={i} className="og-next-step-item">
            <div
              className="og-next-step-icon"
              style={{ background: `${item.color}22`, color: item.color }}
            >
              <i className={`fas ${item.icon}`} />
            </div>
            <div className="og-next-step-body">
              <div className="og-next-step-title">{item.title}</div>
              <div className="og-next-step-desc">{item.desc}</div>
            </div>
            <i className="fas fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
          </div>
        ))}
      </div>

      <div className="og-allset-contact">
        <i className="fas fa-headset" style={{ color: 'var(--primary)', fontSize: 18 }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>Still need help?</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            Contact People Ops at <strong>hr@alignedautomation.com</strong> or message in <strong>#onboarding</strong> on Slack.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllSetStep;
