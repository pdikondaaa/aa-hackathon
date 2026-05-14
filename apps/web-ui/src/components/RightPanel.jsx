import React, { useState, useEffect } from 'react';
import { listMyEscalations } from '../services/api';

const DOMAIN_COLORS = {
  hr:           '#1D76BC',
  it:           '#27AAE1',
  admin:        '#2A3D90',
  organization: '#4ED44E',
};

const STATUS_CONFIG = {
  submitted:   { label: 'Open',        color: '#f05252' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  resolved:    { label: 'Resolved',    color: '#4ED44E' },
};

const RightPanel = ({ config, onClose }) => {
  const { stats, upcoming, labels } = config;

  const [escalations, setEscalations] = useState([]);
  const [escLoading, setEscLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEscLoading(true);
      try {
        const res = await listMyEscalations(1, 10);
        if (!cancelled) setEscalations(res?.data || []);
      } catch (e) {
        console.error('Failed to load escalations:', e);
      } finally {
        if (!cancelled) setEscLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
        {escLoading ? (
          <p style={{ opacity: 0.5, fontSize: '13px', padding: '8px 0' }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading…
          </p>
        ) : escalations.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: '13px', padding: '8px 0' }}>No escalations found</p>
        ) : (
          <ul className="escalation-list">
            {escalations.map((esc) => {
              const domainColor  = DOMAIN_COLORS[esc.escalation_type] || '#1D76BC';
              const statusCfg    = STATUS_CONFIG[esc.status] || { label: esc.status, color: '#a8bdd4' };
              const shortId      = `ESC-${esc.id.slice(0, 6).toUpperCase()}`;
              return (
                <li
                  key={esc.id}
                  className="escalation-card"
                  style={{ borderLeftColor: domainColor }}
                >
                  <p className="escalation-title">{esc.subject}</p>
                  <div className="escalation-meta">
                    <span className="escalation-id">{shortId}</span>
                    <span
                      className="escalation-domain"
                      style={{ backgroundColor: `${domainColor}22`, color: domainColor }}
                    >
                      {esc.escalation_type.toUpperCase()}
                    </span>
                    <span
                      className="escalation-badge"
                      style={{ backgroundColor: `${statusCfg.color}22`, color: statusCfg.color }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
