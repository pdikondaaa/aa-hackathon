import React, { useState, useEffect } from 'react';
import { listMyEscalations } from '../services/api';
import { fetchCalendarEvents } from '../utils/authService';

const DOMAIN_COLORS = {
  hr:           '#1D76BC',
  it:           '#27AAE1',
  admin:        '#2A3D90',
  organization: '#4ED44E',
};


const RightPanel = ({ config, onClose }) => {
  const { stats, labels } = config;

  const [escalations,    setEscalations]    = useState([]);
  const [escLoading,     setEscLoading]     = useState(true);
  const [calEvents,      setCalEvents]      = useState([]);
  const [calLoading,     setCalLoading]     = useState(true);
  const [calError,       setCalError]       = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setEscLoading(true);
      try {
        const res = await listMyEscalations(1, 3);
        if (!cancelled) setEscalations(res?.data || []);
      } catch (e) {
        console.error('Failed to load escalations:', e);
      } finally {
        if (!cancelled) setEscLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCalLoading(true);
      const { events, error } = await fetchCalendarEvents(30, 10);
      if (!cancelled) {
        setCalEvents(events);
        setCalError(error);
        setCalLoading(false);
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
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Upcoming Events (live from Outlook calendar) ── */}
      <section className="right-section" style={{ borderBottom: 'none' }}>
        <p className="right-section-label">{labels.upcoming}</p>
        {calLoading ? (
          <p style={{ opacity: 0.5, fontSize: '13px', padding: '8px 0' }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading…
          </p>
        ) : calError === 'consent_required' ? (
          <p style={{ opacity: 0.5, fontSize: '13px', padding: '8px 0' }}>
            Sign in again to grant calendar access.
          </p>
        ) : calError === 'no_permission' ? (
          <p style={{ opacity: 0.5, fontSize: '13px', padding: '8px 0' }}>
            Calendar permission not granted. Contact your admin.
          </p>
        ) : calEvents.length === 0 ? (
          <p style={{ opacity: 0.4, fontSize: '13px', padding: '8px 0' }}>No upcoming events</p>
        ) : (
          <ul className="upcoming-list">
            {calEvents.map((evt) => {
              const start = evt.start ? new Date(evt.start) : null;
              const dateStr = start
                ? evt.isAllDay
                  ? start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : start.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';
              return (
                <li key={evt.id} className="upcoming-item">
                  <div className="upcoming-indicator" />
                  <div className="upcoming-text">
                    <h4>{evt.title}</h4>
                    <span>{dateStr}{evt.location ? ` · ${evt.location}` : ''}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </aside>
  );
};

export default RightPanel;
