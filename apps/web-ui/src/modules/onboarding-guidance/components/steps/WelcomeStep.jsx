import React from 'react';

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

const WelcomeStep = ({ user, employeeData, peersData, profileError, onNext }) => {
  const firstName = employeeData?.first_name
    || (user?.name ? user.name.split(' ')[0] : 'there');

  const formatDate = (iso) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const startDate      = formatDate(employeeData?.date_of_joining) || '—';
  const manager        = employeeData?.reporting_manager || '—';
  const team           = employeeData?.department
    ? `${employeeData.department}${employeeData.parent_department ? ' · ' + employeeData.parent_department : ''}`
    : '—';
  const location       = employeeData?.location_name || employeeData?.work_location || '—';

  return (
    <div className="og-step-content">
      {profileError && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--warning, #f59e0b)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <i className="fas fa-exclamation-triangle" />
          Your profile could not be loaded from the HR system. Some fields may be empty — please fill them in manually.
        </div>
      )}
      <div className="og-welcome-chip">
        <i className="fas fa-star" />
        Welcome aboard, {firstName}
      </div>
      <div className="og-welcome-meta-cards">
        <div className="og-welcome-meta-card">
          <i className="fas fa-calendar-check" />
          <div>
            <div className="og-welcome-meta-label">Start Date</div>
            <div className="og-welcome-meta-value">{startDate}</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-user-tie" />
          <div>
            <div className="og-welcome-meta-label">Your Manager</div>
            <div className="og-welcome-meta-value">{manager}</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-users" />
          <div>
            <div className="og-welcome-meta-label">Team</div>
            <div className="og-welcome-meta-value">{team}</div>
          </div>
        </div>
        <div className="og-welcome-meta-card">
          <i className="fas fa-map-marker-alt" />
          <div>
            <div className="og-welcome-meta-label">Location</div>
            <div className="og-welcome-meta-value">{location}</div>
          </div>
        </div>
      </div>

      {(() => {
        const peers = peersData?.peers || [];
        const dept  = employeeData?.department || 'your department';
        const shown = peers.slice(0, 5);
        const extra = peers.length > 5 ? peers.length - 5 : 0;
        return (
          <div className="og-welcome-team-row">
            <div className="og-welcome-team-avatars">
              {shown.length > 0 ? shown.map((p, i) => (
                <div
                  key={p.employee_id || p.email || i}
                  className="og-welcome-team-avatar"
                  style={{ background: avatarColor(p.full_name), zIndex: 5 - i }}
                  title={p.full_name}
                >
                  {getInitials(p.full_name)}
                </div>
              )) : ['', '', '', '', ''].map((_, i) => (
                <div key={i} className="og-welcome-team-avatar" style={{ zIndex: 5 - i }} />
              ))}
              {extra > 0 && (
                <div
                  className="og-welcome-team-avatar"
                  style={{ background: 'var(--border)', color: 'var(--text-muted)', zIndex: 0 }}
                  title={`${extra} more colleagues`}
                >
                  +{extra}
                </div>
              )}
            </div>
            <div className="og-welcome-team-text">
              Your team is excited to meet you ·{' '}
              <strong>
                {peers.length > 0 ? `${peers.length} colleague${peers.length === 1 ? '' : 's'} in ${dept}` : `colleagues in ${dept}`}
              </strong>
            </div>
          </div>
        );
      })()}

      <button className="og-start-btn" onClick={onNext}>
        Start Onboarding
        <i className="fas fa-arrow-right" />
      </button>
    </div>
  );
};

export default WelcomeStep;
