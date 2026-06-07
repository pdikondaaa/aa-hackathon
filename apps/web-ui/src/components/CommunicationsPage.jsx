import React, { useState, useEffect, useCallback } from 'react';
import {
  getActiveAnnouncements,
  dismissAnnouncement,
  listPublicEvents,
  submitEventRsvp,
} from '../services/api';

// ── Priority config ────────────────────────────────────────────────────────
const PRI = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', icon: 'fa-circle-exclamation', label: 'Critical' },
  high:     { color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  icon: 'fa-triangle-exclamation', label: 'Urgent' },
  medium:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: 'fa-circle-info',          label: 'Info' },
  low:      { color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  icon: 'fa-circle-check',         label: 'Note' },
};

// ── Event status config ────────────────────────────────────────────────────
const EVT_STATUS = {
  upcoming:  { color: '#60a5fa', label: 'Upcoming',  icon: 'fa-calendar-days' },
  live:      { color: '#4ade80', label: '● Live Now', icon: 'fa-circle-play' },
  completed: { color: '#6b7280', label: 'Completed', icon: 'fa-circle-check' },
  cancelled: { color: '#f87171', label: 'Cancelled', icon: 'fa-ban' },
};

const EVENT_TYPE_ICONS = {
  general:       'fa-calendar-days',
  townhall:      'fa-microphone',
  workshop:      'fa-chalkboard-user',
  training:      'fa-graduation-cap',
  celebration:   'fa-party-horn',
  team_outing:   'fa-person-hiking',
  webinar:       'fa-video',
  holiday:       'fa-umbrella-beach',
};

const STATUS_FILTERS = ['All', 'Upcoming', 'Live', 'Completed', 'Cancelled'];

export default function CommunicationsPage({ user }) {
  const [tab,              setTab]              = useState('events');
  const [announcements,    setAnnouncements]    = useState([]);
  const [events,           setEvents]           = useState([]);
  const [eventFilter,      setEventFilter]      = useState('All');
  const [annLoading,       setAnnLoading]       = useState(true);
  const [evtLoading,       setEvtLoading]       = useState(true);
  const [rsvpLoading,      setRsvpLoading]      = useState({});
  const [dismissing,       setDismissing]       = useState({});

  const loadAnnouncements = useCallback(async () => {
    setAnnLoading(true);
    try {
      const data = await getActiveAnnouncements();
      // Show all published announcements regardless of display_mode
      setAnnouncements(data);
    } catch (_) {
      setAnnouncements([]);
    } finally {
      setAnnLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (status) => {
    setEvtLoading(true);
    try {
      const res = await listPublicEvents(1, 50, status === 'All' ? null : status.toLowerCase());
      setEvents(res.data || []);
    } catch (_) {
      setEvents([]);
    } finally {
      setEvtLoading(false);
    }
  }, []);

  useEffect(() => { loadAnnouncements(); loadEvents('All'); }, [loadAnnouncements, loadEvents]);

  const handleFilterChange = (f) => {
    setEventFilter(f);
    loadEvents(f);
  };

  const handleDismiss = async (ann) => {
    setDismissing(d => ({ ...d, [ann.id]: true }));
    try {
      await dismissAnnouncement(ann.id);
      setAnnouncements(prev => prev.filter(a => a.id !== ann.id));
    } catch (_) {} finally {
      setDismissing(d => ({ ...d, [ann.id]: false }));
    }
  };

  const handleRsvp = async (event, status) => {
    setRsvpLoading(r => ({ ...r, [event.id]: true }));
    try {
      await submitEventRsvp(event.id, { rsvp_status: status });
      setEvents(prev => prev.map(e =>
        e.id === event.id
          ? { ...e, user_rsvp_status: status, rsvp_count: status === 'attending' ? (e.rsvp_count || 0) + 1 : Math.max(0, (e.rsvp_count || 0) - 1) }
          : e
      ));
    } catch (_) {} finally {
      setRsvpLoading(r => ({ ...r, [event.id]: false }));
    }
  };

  const formatDate = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const formatTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredEvents = eventFilter === 'All'
    ? events
    : events.filter(e => e.status === eventFilter.toLowerCase());

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', minHeight: 0 }}>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div style={{
        background:   'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
        borderBottom: '1px solid var(--border)',
        padding:      '28px 32px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #1D76BC22, #27AAE122)',
            border:     '1px solid #1D76BC44',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fas fa-bullhorn" style={{ color: '#27AAE1', fontSize: 16 }} />
          </div>
          <div>
            <h1 style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700, margin: 0 }}>
              Communications
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Announcements &amp; company events
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginTop: 20 }}>
          {[
            { id: 'events',        label: 'Events',        icon: 'fa-calendar-days' },
            { id: 'announcements', label: 'Announcements', icon: 'fa-bullhorn' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background:   'none',
                border:       'none',
                borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                color:        tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                padding:      '10px 18px 12px',
                fontSize:     13,
                fontWeight:   tab === t.id ? 600 : 400,
                cursor:       'pointer',
                transition:   'all 0.2s',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
              }}
            >
              <i className={`fas ${t.icon}`} style={{ fontSize: 12 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>

        {/* ── EVENTS TAB ─────────────────────────────────────────── */}
        {tab === 'events' && (
          <>
            {/* Status filter chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => handleFilterChange(f)}
                  style={{
                    background:   eventFilter === f ? 'var(--primary)' : 'var(--bg-card)',
                    border:       `1px solid ${eventFilter === f ? 'var(--primary)' : 'var(--border)'}`,
                    color:        eventFilter === f ? '#fff' : 'var(--text-secondary)',
                    borderRadius: 20,
                    padding:      '5px 14px',
                    fontSize:     12,
                    fontWeight:   eventFilter === f ? 600 : 400,
                    cursor:       'pointer',
                    transition:   'all 0.2s',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {evtLoading ? (
              <LoadingState label="Loading events…" />
            ) : filteredEvents.length === 0 ? (
              <EmptyState icon="fa-calendar-xmark" label="No events found" sub="Check back later for upcoming events" />
            ) : (
              <div style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap:                 20,
              }}>
                {filteredEvents.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    user={user}
                    onRsvp={handleRsvp}
                    rsvpLoading={!!rsvpLoading[event.id]}
                    formatDate={formatDate}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── ANNOUNCEMENTS TAB ──────────────────────────────────── */}
        {tab === 'announcements' && (
          <>
            {annLoading ? (
              <LoadingState label="Loading announcements…" />
            ) : announcements.length === 0 ? (
              <EmptyState icon="fa-bell-slash" label="No active announcements" sub="Nothing to show right now" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {announcements.map(ann => (
                  <AnnouncementCard
                    key={ann.id}
                    ann={ann}
                    onDismiss={handleDismiss}
                    dismissing={!!dismissing[ann.id]}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// ── Event Card ─────────────────────────────────────────────────────────────

function EventCard({ event, user, onRsvp, rsvpLoading, formatDate, formatTime }) {
  const statusCfg = EVT_STATUS[event.status] || EVT_STATUS.upcoming;
  const typeIcon  = EVENT_TYPE_ICONS[event.event_type] || 'fa-calendar-days';
  const isLive    = event.status === 'live';
  const isPast    = event.status === 'completed' || event.status === 'cancelled';

  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       `1px solid ${isLive ? '#4ade8033' : 'var(--border)'}`,
      borderRadius: 16,
      overflow:     'hidden',
      transition:   'transform 0.2s, box-shadow 0.2s',
      boxShadow:    isLive ? '0 0 0 1px #4ade8022, 0 8px 24px rgba(0,0,0,0.2)' : '0 2px 8px rgba(0,0,0,0.1)',
    }}>
      {/* Cover image or gradient placeholder */}
      {event.cover_image_url ? (
        <div style={{ height: 140, overflow: 'hidden', position: 'relative' }}>
          <img src={event.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{
            position:   'absolute', top: 10, right: 10,
            background: statusCfg.color + 'ee',
            color:      '#000',
            borderRadius: 6,
            padding:    '3px 8px',
            fontSize:   11,
            fontWeight: 700,
          }}>
            {statusCfg.label}
          </div>
        </div>
      ) : (
        <div style={{
          height:     140,
          background: `linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))`,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position:   'relative',
        }}>
          <i className={`fas ${typeIcon}`} style={{ fontSize: 40, color: 'var(--border)', opacity: 0.5 }} />
          <div style={{
            position:   'absolute', top: 10, right: 10,
            background: statusCfg.color + '22',
            border:     `1px solid ${statusCfg.color}44`,
            color:      statusCfg.color,
            borderRadius: 6,
            padding:    '3px 8px',
            fontSize:   11,
            fontWeight: 700,
          }}>
            {isLive && <span style={{ marginRight: 4 }}>●</span>}{statusCfg.label.replace('● ', '')}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 18px' }}>
        {/* Event type chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{
            background:    'var(--bg-elevated)',
            border:        '1px solid var(--border)',
            color:         'var(--text-muted)',
            borderRadius:  4,
            padding:       '2px 8px',
            fontSize:      10,
            fontWeight:    600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            <i className={`fas ${typeIcon}`} style={{ marginRight: 4, fontSize: 9 }} />
            {event.event_type.replace(/_/g, ' ')}
          </span>
          {event.is_virtual && (
            <span style={{
              background:    'rgba(96,165,250,0.15)',
              border:        '1px solid rgba(96,165,250,0.3)',
              color:         '#60a5fa',
              borderRadius:  4,
              padding:       '2px 8px',
              fontSize:      10,
              fontWeight:    600,
              letterSpacing: '0.06em',
            }}>
              <i className="fas fa-video" style={{ marginRight: 4, fontSize: 9 }} /> VIRTUAL
            </span>
          )}
        </div>

        <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700, margin: '0 0 6px', lineHeight: 1.3 }}>
          {event.title}
        </h3>

        {event.description && (
          <p style={{
            color:      'var(--text-secondary)',
            fontSize:   13,
            lineHeight: 1.5,
            margin:     '0 0 12px',
            display:    '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow:   'hidden',
          }}>
            {event.description}
          </p>
        )}

        {/* Date / time / location */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          <MetaRow icon="fa-calendar" text={formatDate(event.starts_at)} />
          <MetaRow icon="fa-clock"
            text={`${formatTime(event.starts_at)}${event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''} ${event.timezone}`}
          />
          {event.location && <MetaRow icon="fa-location-dot" text={event.location} />}
          {event.is_virtual && event.virtual_link && (
            <MetaRow icon="fa-link" text="Virtual link available" />
          )}
          {event.rsvp_count > 0 && (
            <MetaRow icon="fa-users" text={`${event.rsvp_count} attending`} />
          )}
        </div>

        {/* RSVP */}
        {event.rsvp_enabled && !isPast && (
          <RsvpSection
            event={event}
            onRsvp={onRsvp}
            loading={rsvpLoading}
          />
        )}
      </div>
    </div>
  );
}

function MetaRow({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-muted)' }}>
      <i className={`fas ${icon}`} style={{ width: 14, textAlign: 'center', flexShrink: 0 }} />
      <span>{text}</span>
    </div>
  );
}

function RsvpSection({ event, onRsvp, loading }) {
  const current = event.user_rsvp_status;
  const options = [
    { status: 'attending',     label: 'Attend',  icon: 'fa-check',       color: '#4ade80' },
    { status: 'maybe',         label: 'Maybe',   icon: 'fa-circle-question', color: '#fb923c' },
    { status: 'not_attending', label: 'Decline', icon: 'fa-times',       color: '#f87171' },
  ];

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
        RSVP
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => {
          const isActive = current === opt.status;
          return (
            <button
              key={opt.status}
              onClick={() => onRsvp(event, opt.status)}
              disabled={loading}
              style={{
                flex:         1,
                background:   isActive ? `${opt.color}22` : 'var(--bg-elevated)',
                border:       `1px solid ${isActive ? opt.color + '66' : 'var(--border)'}`,
                color:        isActive ? opt.color : 'var(--text-muted)',
                borderRadius: 8,
                padding:      '6px 4px',
                fontSize:     11,
                fontWeight:   isActive ? 700 : 400,
                cursor:       loading ? 'default' : 'pointer',
                transition:   'all 0.2s',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          4,
              }}
            >
              <i className={`fas ${loading ? 'fa-spinner fa-spin' : opt.icon}`} style={{ fontSize: 10 }} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Announcement Card ──────────────────────────────────────────────────────

function AnnouncementCard({ ann, onDismiss, dismissing }) {
  const cfg = PRI[ann.priority] || PRI.medium;
  return (
    <div style={{
      background:   'var(--bg-card)',
      border:       `1px solid ${cfg.color}33`,
      borderRadius: 14,
      overflow:     'hidden',
      display:      'flex',
      flexDirection: 'column',
    }}>
      {/* Priority stripe */}
      <div style={{ height: 3, background: cfg.color, flexShrink: 0 }} />

      <div style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <i className={`fas ${cfg.icon}`} style={{ color: cfg.color, fontSize: 15 }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              background: cfg.bg, border: `1px solid ${cfg.color}33`,
              color: cfg.color, borderRadius: 4, padding: '1px 7px',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            }}>{cfg.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {new Date(ann.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <h4 style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700, margin: '0 0 4px' }}>
            {ann.title}
          </h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
            {ann.message}
          </p>

          {(ann.cta_label || ann.allow_dismiss) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {ann.cta_label && ann.cta_url && (
                <a
                  href={ann.cta_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background:   cfg.color,
                    color:        '#000',
                    borderRadius: 6,
                    padding:      '5px 14px',
                    fontSize:     12,
                    fontWeight:   700,
                    textDecoration: 'none',
                  }}
                >
                  {ann.cta_label}
                </a>
              )}
              {ann.allow_dismiss && (
                <button
                  onClick={() => onDismiss(ann)}
                  disabled={dismissing}
                  style={{
                    background:   'var(--bg-elevated)',
                    border:       '1px solid var(--border)',
                    color:        'var(--text-muted)',
                    borderRadius: 6,
                    padding:      '5px 12px',
                    fontSize:     12,
                    cursor:       dismissing ? 'default' : 'pointer',
                  }}
                >
                  {dismissing ? <i className="fas fa-spinner fa-spin" /> : 'Dismiss'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function LoadingState({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, marginBottom: 12, display: 'block' }} />
      {label}
    </div>
  );
}

function EmptyState({ icon, label, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 32, color: 'var(--border)', marginBottom: 12, display: 'block' }} />
      <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, margin: 0 }}>{label}</p>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{sub}</p>
    </div>
  );
}
