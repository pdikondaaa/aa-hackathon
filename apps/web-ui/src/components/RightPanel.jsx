import React, { useState, useEffect } from 'react';
import { listMyEscalations, getMyAttendance, getTodaysBirthdays } from '../services/api';
import { fetchCalendarEvents } from '../utils/authService';

const DOMAIN_COLORS = {
  hr: '#1D76BC',
  it: '#27AAE1',
  admin: '#2A3D90',
  organization: '#4ED44E',
};


const RightPanel = ({ config, onClose, onSendMessage, user }) => {
    const { stats, labels } = config;

  // ── Escalations state ─────────────────────────────────────────────────────
  const [escalations, setEscalations] = useState([]);
  const [escLoading, setEscLoading] = useState(true);

  // ── Birthdays state ───────────────────────────────────────────────────────
  const [birthdays, setBirthdays] = useState([]);
  const [bdLoading, setBdLoading] = useState(true);

  // ── Attendance state ──────────────────────────────────────────────────────
  const [attData, setAttData] = useState(null);
  const [attLoading, setAttLoading] = useState(true);
  const [attError, setAttError] = useState(false);
  const [attTab, setAttTab] = useState('this'); // 'this' | 'last'

  // ── Calendar state ────────────────────────────────────────────────────────
  const [calEvents, setCalEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(true);
  const [calError, setCalError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    // Load escalations
    (async () => {
      try {
        const res = await listMyEscalations(1, 3);
        if (!cancelled) setEscalations(res?.data || []);
      } catch (e) {
        console.error('Failed to load escalations:', e);
      } finally {
        if (!cancelled) setEscLoading(false);
      }
    })();

    // Load birthdays
    (async () => {
      try {
        const res = await getTodaysBirthdays();
        if (!cancelled) setBirthdays(res?.birthdays || []);
      } catch (e) {
        console.error('Failed to load birthdays:', e);
      } finally {
        if (!cancelled) setBdLoading(false);
      }
    })();

    // Load attendance
    (async () => {
      try {
        const data = await getMyAttendance();
        if (!cancelled && data) {
          setAttData(data);
        }
      } catch (e) {
        console.error('Failed to load attendance:', e);
        if (!cancelled) setAttError(true);
      } finally {
        if (!cancelled) setAttLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Attendance section helpers ────────────────────────────────────────────
  const currentMonth = attData
    ? (attTab === 'this' ? attData.this_month : attData.last_month)
    : null;

  const handleAttChipClick = (type) => {
    if (!currentMonth || !onSendMessage) return;
    const query = type === 'days'
      ? `Show ${user?.name || 'my'} attendance details for ${currentMonth.month_label}`
      : `Show ${user?.name || 'my'} attendance details for ${currentMonth.month_label}`;
    onSendMessage(query);
  };
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
        if (positive === true) return 'positive';
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


      {/* ── Attendance Details ────────────────────────────── */}
      <section className="right-section">
        <p className="right-section-label">ATTENDANCE</p>

        {attLoading ? (
          <p className="rp-loading-text">
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading…
          </p>
        ) : attError || !attData ? (
          <p className="rp-empty-text">Could not load attendance data</p>
        ) : (
          <>
            {/* Month tab switcher */}
            <div className="att-tabs">
              <button
                className={`att-tab ${attTab === 'this' ? 'att-tab--active' : ''}`}
                onClick={() => setAttTab('this')}
              >
                This Month
              </button>
              <button
                className={`att-tab ${attTab === 'last' ? 'att-tab--active' : ''}`}
                onClick={() => setAttTab('last')}
              >
                Last Month
              </button>
            </div>

            {/* Month summary chips — days and hours are clickable */}
            <div className="att-summary">
              <button
                className="att-summary-chip att-summary-chip--btn"
                onClick={() => handleAttChipClick('days')}
                title="Click to see attendance details in chat"
              >
                <span className="att-summary-val">{currentMonth.total_days}</span>
                <span className="att-summary-lbl">days</span>
              </button>
              <button
                className="att-summary-chip att-summary-chip--btn"
                onClick={() => handleAttChipClick('hours')}
                title="Click to see working hours in chat"
              >
                <span className="att-summary-val">{currentMonth.total_hours_label}</span>
                <span className="att-summary-lbl">total hrs</span>
              </button>
              <div className="att-summary-chip">
                <span className="att-summary-val">{currentMonth.month_label.split(' ')[0].slice(0, 3)}</span>
                <span className="att-summary-lbl">{currentMonth.year}</span>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ── Today's Birthdays ──────────────────────────────── */}
      <section className="right-section">
        <p className="right-section-label">
          <i className="fas fa-birthday-cake" style={{ marginRight: 6, color: '#f472b6' }} />
          TODAY'S BIRTHDAYS
        </p>
        {bdLoading ? (
          <p className="rp-loading-text">
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading…
          </p>
        ) : birthdays.length === 0 ? (
          <p className="rp-empty-text">No birthdays today 🎂</p>
        ) : (
          <ul className="birthday-list">
            {birthdays.map((person, idx) => (
              <li key={idx} className="birthday-card">
                <div className="birthday-avatar">
                  {person.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="birthday-info">
                  <p className="birthday-name">{person.full_name}</p>
                  {person.department && (
                    <span className="birthday-dept">{person.department}</span>
                  )}
                </div>
                <span className="birthday-emoji">🎉</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Escalations ───────────────────────────────────── */}
      <section className="right-section" style={{ borderBottom: 'none' }}>
        <p className="right-section-label">{labels.escalations}</p>
        {escLoading ? (
          <p className="rp-loading-text">
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading…
          </p>
        ) : escalations.length === 0 ? (
          <p className="rp-empty-text">No escalations found</p>
        ) : (
          <ul className="escalation-list">
            {escalations.map((esc) => {
              const domainColor = DOMAIN_COLORS[esc.escalation_type] || '#1D76BC';
              const shortId = `ESC-${esc.id.slice(0, 6).toUpperCase()}`;
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
