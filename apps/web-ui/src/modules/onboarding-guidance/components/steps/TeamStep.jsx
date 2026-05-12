import React from 'react';
import { TEAM_MEMBERS, TOOLS, QUICK_RESOURCES } from '../../constants/onboardingData';

const BADGE_STYLES = {
  MANAGER: { bg: 'rgba(29,118,188,0.15)',  color: 'var(--primary)'   },
  BUDDY:   { bg: 'rgba(39,170,225,0.15)', color: 'var(--light-blue)' },
  POD:     { bg: 'rgba(94,122,154,0.14)', color: 'var(--text-muted)' },
};

const TeamStep = () => {
  return (
    <div className="og-step-content">
      <div className="og-step-header">
        <h2 className="og-step-title">Meet your team &amp; resources</h2>
        <p className="og-step-subtitle">
          Here's who you'll work with and the tools to get you up to speed.
        </p>
      </div>

      {/* Your Pod */}
      <section className="og-team-section">
        <div className="og-team-section-header">
          <span className="og-team-section-title">Your pod</span>
          <span className="og-team-section-meta">Engineering · Pod 3</span>
        </div>

        <div className="og-team-grid">
          {TEAM_MEMBERS.map(member => {
            const badgeStyle = BADGE_STYLES[member.badge] || BADGE_STYLES.POD;
            return (
              <div key={member.id} className="og-team-card">
                <div className="og-team-card-top">
                  <div
                    className="og-team-avatar"
                    style={{ background: member.color }}
                  >
                    {member.initials}
                  </div>
                  <span
                    className="og-team-badge"
                    style={{ background: badgeStyle.bg, color: badgeStyle.color }}
                  >
                    {member.badge}
                  </span>
                </div>
                <div className="og-team-name">{member.name}</div>
                <div className="og-team-role">{member.role}</div>
                <button className="og-team-msg-btn">
                  <i className="fas fa-comment" /> Send intro message
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tools & Resources row */}
      <div className="og-tools-resources-row">
        {/* Tools & Software */}
        <section className="og-team-section" style={{ flex: 1 }}>
          <div className="og-team-section-header">
            <span className="og-team-section-title">
              <i className="fas fa-tools" style={{ marginRight: 6, opacity: 0.6 }} />
              Tools &amp; software
            </span>
            <span className="og-team-section-meta">Pre-installed via SSO</span>
          </div>

          <div className="og-software-grid">
            {TOOLS.map(tool => (
              <div key={tool.id} className="og-software-item">
                <div
                  className="og-software-icon"
                  style={{ background: tool.color }}
                >
                  {tool.initial}
                </div>
                <div>
                  <div className="og-software-name">{tool.name}</div>
                  <div className="og-software-desc">{tool.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Resources */}
        <section className="og-team-section og-quick-resources">
          <div className="og-team-section-header">
            <span className="og-team-section-title">
              <i className="fas fa-book-open" style={{ marginRight: 6, opacity: 0.6 }} />
              Quick resources
            </span>
          </div>

          <div className="og-resources-list">
            {QUICK_RESOURCES.map((r, i) => (
              <div key={i} className="og-resource-item">
                <span>{r}</span>
                <i className="fas fa-external-link-alt" style={{ opacity: 0.4, fontSize: 11 }} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeamStep;
