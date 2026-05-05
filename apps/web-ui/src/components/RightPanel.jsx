import React from 'react';

// Right overview panel — stats cards, activity feed, escalations, upcoming events.
const RightPanel = ({ config, onClose }) => {
  const { stats, recentActivity, escalations, upcoming, labels } = config;

  // Determine delta colour class
  const deltaClass = (positive) => {
    if (positive === true)  return 'positive';
    if (positive === false) return 'negative';
    return 'neutral';
  };

  return (
    <aside className="right-panel" aria-label="Overview panel">

      {/* Panel header */}
      <div className="right-panel-header">
        <h2>{labels.overview}</h2>
        <button className="right-panel-close" onClick={onClose} aria-label="Close overview panel">
          <i className="fas fa-times" />
        </button>
      </div>

      {/* ── My Stats ─────────────────────────────────────── */}
      <section className="right-section">
        <p className="right-section-label">{labels.myStats}</p>
        <div className="stats-grid">
          {stats.map((s) => (
            <div className="stat-card" key={s.id}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
              <span className={`stat-delta ${deltaClass(s.positive)}`}>{s.delta}</span>
            </div>
          ))}
        </div>
      </section>

      

      {/* ── Escalations ───────────────────────────────────── */}
      <section className="right-section">
        <p className="right-section-label">{labels.escalations}</p>
        <ul className="escalation-list">
          {escalations.map((esc) => (
            <li
              key={esc.id}
              className="escalation-card"
              style={{ borderLeftColor: esc.domainColor }}
            >
              <p className="escalation-title">{esc.title}</p>
              <div className="escalation-meta">
                <span className="escalation-id">{esc.id}</span>
                <span
                  className="escalation-domain"
                  style={{ backgroundColor: `${esc.domainColor}22`, color: esc.domainColor }}
                >
                  {esc.domain}
                </span>
                <span
                  className="escalation-badge"
                  style={{ backgroundColor: `${esc.statusColor}22`, color: esc.statusColor }}
                >
                  {esc.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Upcoming Events ───────────────────────────────── */}
      <section className="right-section" style={{ borderBottom: 'none' }}>
        <p className="right-section-label">{labels.upcoming}</p>
        <ul className="upcoming-list">
          {upcoming.map((evt) => (
            <li key={evt.id} className="upcoming-item">
              <div className="upcoming-indicator" />
              <div className="upcoming-text">
                <h4>{evt.title}</h4>
                <span>{evt.date}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

    </aside>
  );
};

export default RightPanel;
