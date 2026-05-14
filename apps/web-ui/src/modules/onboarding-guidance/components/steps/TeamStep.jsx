import React from 'react';
import { TOOLS, QUICK_RESOURCES } from '../../constants/onboardingData';

const BADGE_STYLES = {
  MANAGER:  { bg: 'rgba(29,118,188,0.15)',  color: 'var(--primary)'   },
  FUNCTION: { bg: 'rgba(78,212,78,0.15)',   color: '#2a7a2a'          },
  PEER:     { bg: 'rgba(94,122,154,0.14)',  color: 'var(--text-muted)'},
};

const AVATAR_COLORS = [
  '#1D76BC','#27AAE1','#4ED44E','#2A3D90','#f59e0b',
  '#e11d48','#7c3aed','#0891b2','#15803d','#b45309',
];

function getInitials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}

function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (name.codePointAt(i) ?? 0) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const MemberCard = ({ member }) => {
  const badgeStyle = BADGE_STYLES[member.badge] || BADGE_STYLES.PEER;

  const handleMessage = () => {
    if (!member.email) return;
    window.open(
      `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(member.email)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="og-team-card">
      <div className="og-team-card-top">
        <div className="og-team-avatar" style={{ background: member.color }}>
          {member.initials}
        </div>
        <span className="og-team-badge" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
          {member.badge}
        </span>
      </div>
      <div className="og-team-name">{member.name}</div>
      <div className="og-team-role">{member.role}</div>
      {member.location && (
        <div className="og-team-role" style={{ fontSize: 11, opacity: 0.65 }}>
          <i className="fas fa-map-marker-alt" style={{ marginRight: 4 }} />{member.location}
        </div>
      )}
      <button
        className="og-team-msg-btn"
        onClick={handleMessage}
        disabled={!member.email}
        title={member.email ? `Message ${member.name} on Teams` : 'Email not available'}
      >
        <i className="fas fa-comment" /> Send intro message
      </button>
    </div>
  );
};

const TeamStep = ({ employeeData, peersData, onNext }) => {
  const department = employeeData?.department || 'Your Department';

  const managers = [];
  if (employeeData?.reporting_manager) {
    managers.push({
      id:       'manager',
      name:     employeeData.reporting_manager,
      email:    employeeData.reporting_manager_email || null,
      role:     'Reporting Manager',
      initials: getInitials(employeeData.reporting_manager),
      color:    '#1D76BC',
      badge:    'MANAGER',
    });
  }
  const funcMgr = employeeData?.functional_manager;
  if (funcMgr && funcMgr !== employeeData?.reporting_manager) {
    managers.push({
      id:       'functional-manager',
      name:     funcMgr,
      email:    employeeData.functional_manager_email || null,
      role:     'Functional Manager',
      initials: getInitials(funcMgr),
      color:    '#4ED44E',
      badge:    'FUNCTION',
    });
  }

  const peers = (peersData?.peers || []).map(p => ({
    id:       p.employee_id || p.email,
    name:     p.full_name,
    email:    p.email || null,
    role:     p.designation || p.department || '',
    initials: getInitials(p.full_name),
    color:    avatarColor(p.full_name),
    badge:    'PEER',
    location: p.location,
  }));

  const peersLoading = employeeData && peersData === null;

  return (
    <div className="og-step-content">

      {/* Team excitement banner */}
      {peers.length > 0 && (
        <div className="og-team-banner">
          <div className="og-team-banner-avatars">
            {peers.slice(0, 5).map((p, i) => (
              <div
                key={p.id}
                className="og-team-banner-avatar"
                style={{ background: p.color, zIndex: 5 - i }}
                title={p.name}
              >
                {p.initials}
              </div>
            ))}
            {peers.length > 5 && (
              <div
                className="og-team-banner-avatar og-team-banner-avatar--more"
                style={{ zIndex: 0 }}
                title={`${peers.length - 5} more colleagues`}
              >
                +{peers.length - 5}
              </div>
            )}
          </div>
          <div className="og-team-banner-text">
            <span className="og-team-banner-title">Your team is excited to meet you</span>
            <span className="og-team-banner-sub">
              {peers.length} colleague{peers.length === 1 ? '' : 's'} in {department}
            </span>
          </div>
        </div>
      )}

      {/* Managers */}
      {managers.length > 0 && (
        <section className="og-team-section">
          <div className="og-team-section-header">
            <span className="og-team-section-title">Your managers</span>
            <span className="og-team-section-meta">{department}</span>
          </div>
          <div className="og-team-grid">
            {managers.map(m => <MemberCard key={m.id} member={m} />)}
          </div>
        </section>
      )}

      {/* Peers */}
      <section className="og-team-section">
        <div className="og-team-section-header">
          <span className="og-team-section-title">Your peers</span>
          <span className="og-team-section-meta">
            {peersLoading
              ? 'Loading…'
              : peers.length > 0
                ? `${peers.length} colleague${peers.length === 1 ? '' : 's'} · Reports to ${peersData?.reporting_manager}`
                : department}
          </span>
        </div>

        {peersLoading ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
            Loading colleagues…
          </p>
        ) : peers.length > 0 ? (
          <div className="og-team-grid">
            {peers.map(p => <MemberCard key={p.id} member={p} />)}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
            {peersData ? 'No colleagues found with the same reporting manager.' : 'Loading colleagues…'}
          </p>
        )}
      </section>

      {/* Tools & Resources row */}
      <div className="og-tools-resources-row">
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
                <div className="og-software-icon" style={{ background: tool.color }}>
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

      <div className="og-step-footer" style={{ justifyContent: 'flex-end' }}>
        <button className="og-btn-primary" onClick={onNext}>
          Continue <i className="fas fa-arrow-right" />
        </button>
      </div>
    </div>
  );
};

export default TeamStep;
