import React, { useState, useEffect, useCallback } from 'react';
import { getActiveAnnouncements, listPublicEvents } from '../services/api';

// ── Brand palette ──────────────────────────────────────────────────────────
// #1D76BC  Aligned Blue   #27AAE1  Light Blue
// #2A3D90  Deep Blue      #4ED44E  Energy Green (accent)

const PRI = {
  critical: { color: '#2A3D90', bg: 'rgba(42,61,144,0.08)',  border: 'rgba(42,61,144,0.25)',  icon: 'fa-circle-exclamation',   label: 'Critical' },
  high:     { color: '#1D76BC', bg: 'rgba(29,118,188,0.08)', border: 'rgba(29,118,188,0.25)', icon: 'fa-triangle-exclamation', label: 'Urgent'   },
  medium:   { color: '#27AAE1', bg: 'rgba(39,170,225,0.08)', border: 'rgba(39,170,225,0.25)', icon: 'fa-circle-info',          label: 'Info'     },
  low:      { color: '#4ED44E', bg: 'rgba(78,212,78,0.08)',  border: 'rgba(78,212,78,0.25)',  icon: 'fa-circle-check',         label: 'Note'     },
};

const EVT_TYPE_ICON = {
  general:     'fa-calendar-days',
  townhall:    'fa-microphone',
  workshop:    'fa-chalkboard-user',
  training:    'fa-graduation-cap',
  celebration: 'fa-party-horn',
  team_outing: 'fa-person-hiking',
  webinar:     'fa-video',
  holiday:     'fa-umbrella-beach',
};

// ── Date / time helpers ────────────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return '';
  const d    = new Date(dt);
  const diff = Math.floor((d - new Date()) / 86400000);
  if (diff === 0)            return 'Today';
  if (diff === 1)            return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const PULSE_STYLE = `@keyframes comm-pulse{0%,100%{opacity:1}50%{opacity:0.45}}`;

export default function CommunicationsWidget({ user, onNavigate, closed, onClose }) {
  const [announcements, setAnnouncements] = useState([]);
  const [events,        setEvents]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [collapsed,     setCollapsed]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [annData, upcomingRes, liveRes] = await Promise.all([
        getActiveAnnouncements(),
        listPublicEvents(1, 6, 'upcoming'),
        listPublicEvents(1, 3, 'live'),
      ]);
      setAnnouncements((annData || []).slice(0, 6));
      const allEvts = [...(liveRes.data || []), ...(upcomingRes.data || [])];
      setEvents(allEvts.slice(0, 6));
    } catch (err) {
      console.error('[CommunicationsWidget] Failed to load data:', err);
      setAnnouncements([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!closed) load(); }, [load, closed]);

  const handleDismissOne = (id) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  if (closed) return null;

  const hasAnn  = announcements.length > 0;
  const hasEvts = events.length > 0;
  const showBody = !loading && (hasAnn || hasEvts);

  return (
    <>
      <style>{PULSE_STYLE}</style>
      <div style={{
        background:   'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
        borderBottom: '1px solid var(--border)',
        flexShrink:   0,
        maxHeight:    (!showBody || collapsed) ? 40 : 230,
        overflow:     'hidden',
        transition:   'max-height 0.25s ease',
      }}>

        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <div style={{
          display:      'flex',
          alignItems:   'center',
          padding:      '0 16px',
          height:       40,
          gap:          8,
          borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
          flexShrink:   0,
        }}>
          <i className="fas fa-bullhorn" style={{ color: '#1D76BC', fontSize: 12 }} />
          <span style={{
            color: 'var(--text-secondary)', fontSize: 11,
            fontWeight: 700, letterSpacing: '0.07em', flex: 1,
          }}>
            COMMUNICATIONS
          </span>

          {hasAnn  && <Pill count={announcements.length} color="#1D76BC" label="announcement" />}
          {hasEvts && <Pill count={events.length}        color="#27AAE1" label="event" />}

          <button onClick={() => onNavigate('communications')} style={headerBtnStyle('#1D76BC')}>
            <i className="fas fa-arrow-up-right-from-square" style={{ marginRight: 4, fontSize: 9 }} />
            View All
          </button>
          <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'} style={headerBtnStyle('var(--text-muted)')}>
            <i className={`fas fa-chevron-${collapsed ? 'down' : 'up'}`} style={{ fontSize: 10 }} />
          </button>
          <button
            onClick={onClose}
            title="Close — reappears on next page reload"
            style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
              fontSize: 13, lineHeight: 1, display: 'flex', alignItems: 'center',
            }}
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        {!collapsed && (
          <div style={{ display: 'flex', overflow: 'hidden' }}>

            {/* ── Events panel ─────────────────────────────────────────── */}
            {hasEvts && (
              <div style={{
                flex: hasAnn ? '0 0 50%' : '1 1 100%',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}>

                {/* Section label */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '7px 16px 5px', gap: 8, flexShrink: 0,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: 'linear-gradient(135deg, rgba(29,118,188,0.22), rgba(39,170,225,0.1))',
                    border: '1px solid rgba(29,118,188,0.35)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(29,118,188,0.18)',
                  }}>
                    <i className="fas fa-calendar-days" style={{ color: '#27AAE1', fontSize: 10 }} />
                  </div>
                  <span style={{
                    background: 'linear-gradient(90deg, #1D76BC, #27AAE1)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', flex: 1,
                  }}>
                    UPCOMING EVENTS
                  </span>
                  <span style={{
                    background: 'rgba(39,170,225,0.1)', border: '1px solid rgba(39,170,225,0.25)',
                    color: '#27AAE1', borderRadius: 8, padding: '1px 8px',
                    fontSize: 9, fontWeight: 700,
                  }}>
                    {events.length} upcoming
                  </span>
                </div>

                {/* Cards row */}
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', flexDirection: 'row',
                    overflowX: 'auto', overflowY: 'hidden',
                    padding: '2px 16px 10px', gap: 10, scrollbarWidth: 'thin',
                  }}>
                    {events.map(evt => {
                      const isLive   = evt.status === 'live';
                      const typeIcon = EVT_TYPE_ICON[evt.event_type] || 'fa-calendar-days';
                      const dateObj  = new Date(evt.starts_at);
                      const weekday  = dateObj.toLocaleDateString('en-IN', { weekday: 'short' });
                      return (
                        <div
                          key={evt.id}
                          onClick={() => onNavigate('communications')}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = isLive
                              ? '0 8px 24px rgba(78,212,78,0.2)'
                              : '0 8px 24px rgba(29,118,188,0.18)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 2px 10px rgba(29,118,188,0.08)';
                          }}
                          style={{
                            background:   'var(--bg-elevated)',
                            border:       '1px solid rgba(29,118,188,0.12)',
                            borderRadius: 12,
                            boxShadow:    '0 2px 10px rgba(29,118,188,0.08)',
                            padding:      '11px 13px 10px',
                            cursor:       'pointer',
                            flexShrink:   0,
                            width:        230,
                            transition:   'transform 0.15s, box-shadow 0.15s',
                          }}
                        >
                          {/* ── Card header: badge + info + when pill ── */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 9 }}>

                            {/* Gradient date badge */}
                            <div style={{
                              background:     isLive
                                ? 'linear-gradient(135deg, #4ED44E 0%, #27a830 100%)'
                                : 'linear-gradient(135deg, #27AAE1 0%, #1D76BC 55%, #2A3D90 100%)',
                              borderRadius:   10,
                              width:          44,
                              height:         44,
                              display:        'flex',
                              flexDirection:  'column',
                              alignItems:     'center',
                              justifyContent: 'center',
                              flexShrink:     0,
                              boxShadow:      isLive
                                ? '0 3px 10px rgba(78,212,78,0.4)'
                                : '0 3px 10px rgba(29,118,188,0.4)',
                            }}>
                              <div style={{ color: '#fff', fontSize: 19, fontWeight: 800, lineHeight: 1 }}>
                                {dateObj.getDate()}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>
                                {dateObj.toLocaleDateString('en-IN', { month: 'short' })}
                              </div>
                            </div>

                            {/* Day name + event type */}
                            <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                              <div style={{ color: '#1D76BC', fontSize: 12, fontWeight: 700, marginBottom: 4, letterSpacing: '0.01em' }}>
                                {dateObj.toLocaleDateString('en-IN', { weekday: 'long' })}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <i className={`fas ${typeIcon}`} style={{ color: '#27AAE1', fontSize: 10 }} />
                                <span style={{ color: '#2A3D90', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {(evt.event_type || 'general').replace(/_/g, ' ')}
                                </span>
                              </div>
                            </div>

                            {/* When / LIVE pill */}
                            {isLive ? (
                              <span style={{
                                background:    'rgba(78,212,78,0.14)',
                                border:        '1px solid rgba(78,212,78,0.4)',
                                color:         '#4ED44E',
                                borderRadius:  20,
                                padding:       '3px 8px',
                                fontSize:      9,
                                fontWeight:    800,
                                letterSpacing: '0.05em',
                                flexShrink:    0,
                                animation:     'comm-pulse 2s ease-in-out infinite',
                              }}>● LIVE</span>
                            ) : (
                              <span style={{
                                background:   'rgba(39,170,225,0.1)',
                                border:       '1px solid rgba(39,170,225,0.22)',
                                color:        '#1D76BC',
                                borderRadius: 20,
                                padding:      '3px 9px',
                                fontSize:     10,
                                fontWeight:   600,
                                flexShrink:   0,
                              }}>
                                {weekday}
                              </span>
                            )}
                          </div>

                          {/* ── Title ── */}
                          <div style={{
                            color:        'var(--text)',
                            fontSize:     13,
                            fontWeight:   700,
                            overflow:     'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace:   'nowrap',
                            marginBottom: 8,
                            lineHeight:   1.35,
                          }}>
                            {evt.title}
                          </div>

                          {/* ── Footer ── */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <i className="fas fa-clock" style={{ fontSize: 9, color: '#27AAE1' }} />
                              {fmtTime(evt.starts_at)}
                            </span>
                            {evt.is_virtual ? (
                              <span style={{ color: '#27AAE1', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <i className="fas fa-video" style={{ fontSize: 9 }} />
                                Virtual
                              </span>
                            ) : evt.location && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <i className="fas fa-location-dot" style={{ fontSize: 9, color: '#27AAE1', flexShrink: 0 }} />
                                {evt.location}
                              </span>
                            )}
                            {evt.rsvp_enabled && (
                              <span style={{
                                background:   'rgba(39,170,225,0.1)',
                                border:       '1px solid rgba(39,170,225,0.28)',
                                color:        '#27AAE1',
                                borderRadius: 20,
                                padding:      '2px 10px',
                                fontSize:     9,
                                fontWeight:   700,
                                marginLeft:   'auto',
                              }}>
                                RSVP
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Scroll fade hint */}
                  <div style={{
                    position: 'absolute', right: 0, top: 0, bottom: 0, width: 36,
                    background: 'linear-gradient(to right, transparent, var(--bg-secondary))',
                    pointerEvents: 'none',
                  }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Small reusable pieces ──────────────────────────────────────────────────

function Pill({ count, color, label }) {
  return (
    <span style={{
      background: `${color}18`, border: `1px solid ${color}33`, color,
      borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {count} {label}{count !== 1 ? 's' : ''}
    </span>
  );
}

function headerBtnStyle(color) {
  return {
    background: 'none', border: '1px solid var(--border)', color,
    borderRadius: 5, padding: '3px 8px', fontSize: 10, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
  };
}
