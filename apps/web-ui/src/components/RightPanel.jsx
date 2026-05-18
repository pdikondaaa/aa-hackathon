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
          (() => {
            const getDisplayTimeZone = () => {
              const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
              const region = (user?.workLocation || browserZone || '').toLowerCase();
              if (region.includes('india') || region.includes('kolkata') || region.includes('calcutta')) return 'Asia/Kolkata';
              if (region.includes('new york') || region.includes('america') || region.includes('us') || region.includes('eastern')) return 'America/New_York';
              return browserZone;
            };

            const displayTimeZone = getDisplayTimeZone();

            const parseCalendarDate = (dateStr, zone) => {
              if (!dateStr) return null;
              if (dateStr.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(dateStr)) {
                return new Date(dateStr);
              }
              if (zone && typeof zone === 'string' && zone.toLowerCase().includes('utc')) {
                return new Date(`${dateStr}Z`);
              }
              return new Date(dateStr);
            };

            const toDateInTimeZone = (date, timeZone) => {
              if (!date) return null;
              const parts = new Intl.DateTimeFormat('en-US', {
                timeZone,
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              }).formatToParts(date);
              const year = Number(parts.find(p => p.type === 'year')?.value || 0);
              const month = Number(parts.find(p => p.type === 'month')?.value || 1);
              const day = Number(parts.find(p => p.type === 'day')?.value || 1);
              return new Date(year, month - 1, day);
            };

            const formatTime = (date) => {
              if (!date) return null;
              return new Intl.DateTimeFormat('en-US', {
                timeZone: displayTimeZone,
                hour: '2-digit',
                minute: '2-digit',
              }).format(date);
            };

            const formatTimeZoneName = (date) => {
              const tzName = new Intl.DateTimeFormat('en-US', {
                timeZone: displayTimeZone,
                timeZoneName: 'short',
              })
                .formatToParts(date)
                .find(p => p.type === 'timeZoneName')?.value || '';

              const zoneKey = displayTimeZone.toLowerCase();
              if (zoneKey.includes('kolkata') || zoneKey.includes('calcutta') || zoneKey.includes('india')) return 'IST';
              if (zoneKey.includes('new_york') || zoneKey.includes('america') || zoneKey.includes('eastern')) {
                if (tzName.includes('-04')) return 'EDT';
                return 'EST';
              }
              if (/^gmt/i.test(tzName)) return '';
              return tzName;
            };

            const now = new Date();
            const todayStart = toDateInTimeZone(now, displayTimeZone);
            const tomorrowStart = new Date(todayStart);
            tomorrowStart.setDate(todayStart.getDate() + 1);

            const dayOfWeek = todayStart.getDay(); // 0=Sun … 6=Sat
            const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

            // This Sunday — last day shown
            const thisSundayStart = new Date(todayStart);
            thisSundayStart.setDate(todayStart.getDate() + daysToSunday);

            // Monday after this Sunday — exclusive cut-off
            const weekEnd = new Date(thisSundayStart);
            weekEnd.setDate(thisSundayStart.getDate() + 1);

            const toLocalDay = (evt) => {
              if (!evt.start) return null;
              if (evt.isAllDay) {
                const [y, m, d] = evt.start.split('T')[0].split('-').map(Number);
                return new Date(y, m - 1, d);
              }
              const eventDate = parseCalendarDate(evt.start, evt.startZone);
              return toDateInTimeZone(eventDate, displayTimeZone);
            };

            const getBucket = (evt) => {
              const dDay = toLocalDay(evt);
              if (!dDay) return null;
              if (dDay < todayStart) return null;  // past
              if (dDay >= weekEnd) return null;    // next week — skip
              if (dDay.getTime() === todayStart.getTime()) return 'Today';
              if (dDay.getTime() === tomorrowStart.getTime()) return 'Tomorrow';
              return dDay.toLocaleDateString(undefined, { weekday: 'long' });
            };

            // Build ordered buckets: Today → Tomorrow → day names through Sunday
            const BUCKET_ORDER = ['Today', 'Tomorrow'];
            for (let i = 2; i <= daysToSunday; i++) {
              const d = new Date(todayStart);
              d.setDate(todayStart.getDate() + i);
              const name = d.toLocaleDateString(undefined, { weekday: 'long' });
              if (!BUCKET_ORDER.includes(name)) BUCKET_ORDER.push(name);
            }

            const groups = {};
            calEvents.forEach((evt) => {
              const bucket = getBucket(evt);
              if (bucket === null) return;
              if (!groups[bucket]) groups[bucket] = [];
              groups[bucket].push(evt);
            });

            const visibleBuckets = BUCKET_ORDER.filter(b => groups[b]?.length);
            if (visibleBuckets.length === 0) {
              return <p style={{ opacity: 0.4, fontSize: '13px', padding: '8px 0' }}>No events this week</p>;
            }
            return visibleBuckets.map((bucket) => (
              <div key={bucket} style={{ marginBottom: 10 }}>
                <p style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  opacity: 0.45,
                  margin: '6px 0 4px',
                }}>
                  {bucket}
                </p>
                <ul className="upcoming-list" style={{ margin: 0 }}>
                  {groups[bucket].map((evt) => {
                    const eventDate = evt.start && !evt.isAllDay
                      ? parseCalendarDate(evt.start, evt.startZone)
                      : null;
                    const start = eventDate ? toDateInTimeZone(eventDate, displayTimeZone) : null;
                    const timeStr = eventDate
                      ? `${formatTime(eventDate)} ${formatTimeZoneName(eventDate)}`
                      : null;
                    return (
                      <li key={evt.id} className="upcoming-item">
                        <div className="upcoming-indicator" />
                        <div className="upcoming-text">
                          <h4>{evt.title}</h4>
                          <span>
                            {timeStr || 'All day'}
                            {evt.location ? ` · ${evt.location}` : ''}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ));
          })()
        )}
      </section>

    </aside>
  );
};

export default RightPanel;
