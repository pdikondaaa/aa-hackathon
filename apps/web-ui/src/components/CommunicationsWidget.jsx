import React, { useState, useEffect, useCallback } from 'react';
import { getActiveAnnouncements, listPublicEvents } from '../services/api';

// ── Lookup tables ──────────────────────────────────────────────────────────
const PRI = {
  critical: { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)', icon: 'fa-circle-exclamation', label: 'Critical' },
  high:     { color: '#fb923c', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.25)',  icon: 'fa-triangle-exclamation', label: 'Urgent'   },
  medium:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)',  icon: 'fa-circle-info',          label: 'Info'     },
  low:      { color: '#4ade80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)',  icon: 'fa-circle-check',         label: 'Note'     },
};

const EVT_TYPE_ICON = {
  general: 'fa-calendar-days', townhall: 'fa-microphone',
  workshop: 'fa-chalkboard-user', training: 'fa-graduation-cap',
  celebration: 'fa-party-horn', team_outing: 'fa-person-hiking',
  webinar: 'fa-video', holiday: 'fa-umbrella-beach',
};

// ── Date / time helpers ────────────────────────────────────────────────────
function fmtDate(dt) {
  if (!dt) return '';
  const d    = new Date(dt);
  const diff = Math.floor((d - new Date()) / 86400000);
  if (diff === 0)           return 'Today';
  if (diff === 1)           return 'Tomorrow';
  if (diff > 1 && diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function fmtTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

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
  // While loading, keep the widget visible (header only) so layout doesn't shift
  const showBody = !loading && (hasAnn || hasEvts);

  return (
    <div style={{
      background:   'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-elevated) 100%)',
      borderBottom: '1px solid var(--border)',
      flexShrink:   0,
      maxHeight:    (!showBody || collapsed) ? 40 : 160,
      overflow:     'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{
        display:      'flex',
        alignItems:   'center',
        padding:      '0 16px',
        height:       40,
        gap:          8,
        borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        flexShrink:   0,
      }}>
        {/* Icon + title */}
        <i className="fas fa-bullhorn" style={{ color: 'var(--primary)', fontSize: 12 }} />
        <span style={{
          color:         'var(--text-secondary)',
          fontSize:      11,
          fontWeight:    700,
          letterSpacing: '0.07em',
          flex:          1,
        }}>
          COMMUNICATIONS
        </span>

        {/* Count pills */}
        {hasAnn && (
          <Pill count={announcements.length} color="#fb923c" label="announcement" />
        )}
        {hasEvts && (
          <Pill count={events.length} color="#60a5fa" label="event" />
        )}

        {/* View All */}
        <button
          onClick={() => onNavigate('communications')}
          style={headerBtnStyle('#1D76BC')}
        >
          <i className="fas fa-arrow-up-right-from-square" style={{ marginRight: 4, fontSize: 9 }} />
          View All
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={headerBtnStyle('var(--text-muted)')}
        >
          <i className={`fas fa-chevron-${collapsed ? 'down' : 'up'}`} style={{ fontSize: 10 }} />
        </button>

        {/* Close — dismisses for the session, reappears on page reload */}
        <button
          onClick={onClose}
          title="Close — reappears on next page reload"
          style={{
            background:   'none',
            border:       'none',
            color:        'var(--text-muted)',
            cursor:       'pointer',
            padding:      '4px 6px',
            borderRadius: 4,
            fontSize:     13,
            lineHeight:   1,
            display:      'flex',
            alignItems:   'center',
          }}
        >
          <i className="fas fa-times" />
        </button>
      </div>

      {/* ── Body — side-by-side panels ──────────────────────────────── */}
      {!collapsed && (
        <div style={{
          display:    'flex',
          overflow:   'hidden',
        }}>

          {/* ── RIGHT: Events ────────────────────────────────────────── */}
          {hasEvts && (
            <div style={{
              flex:      hasAnn ? '0 0 50%' : '1 1 100%',
              display:   'flex',
              flexDirection: 'column',
              overflow:  'hidden',
            }}>
              {/* Section header */}
              <div style={{
                display:    'flex',
                alignItems: 'center',
                padding:    '6px 16px 4px',
                gap:        6,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 5,
                  background: 'rgba(96,165,250,0.15)',
                  border:     '1px solid rgba(96,165,250,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className="fas fa-calendar-days" style={{ color: '#60a5fa', fontSize: 9 }} />
                </div>
                <span style={{
                  color:         '#60a5fa',
                  fontSize:      10,
                  fontWeight:    700,
                  letterSpacing: '0.08em',
                  flex:          1,
                }}>
                  UPCOMING EVENTS
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {events.length} upcoming
                </span>
              </div>

              {/* Horizontal scrollable row */}
              <div style={{
                display:        'flex',
                flexDirection:  'row',
                overflowX:      'auto',
                overflowY:      'hidden',
                padding:        '4px 12px 8px',
                gap:            12,
                scrollbarWidth: 'thin',
              }}>
                {events.map(evt => {
                  const isLive   = evt.status === 'live';
                  const color    = isLive ? '#4ade80' : '#60a5fa';
                  const typeIcon = EVT_TYPE_ICON[evt.event_type] || 'fa-calendar-days';
                  return (
                    <div
                      key={evt.id}
                      onClick={() => onNavigate('communications')}
                      style={{
                        background:   `${color}08`,
                        border:       `1px solid ${color}25`,
                        borderLeft:   `3px solid ${color}`,
                        borderRadius: 8,
                        padding:      '6px 10px',
                        display:      'flex',
                        gap:          8,
                        alignItems:   'center',
                        cursor:       'pointer',
                        flexShrink:   0,
                        width:        220,
                        transition:   'background 0.15s',
                      }}
                    >
                      {/* Date block */}
                      <div style={{
                        background:   `${color}18`,
                        border:       `1px solid ${color}30`,
                        borderRadius: 6,
                        padding:      '3px 6px',
                        textAlign:    'center',
                        flexShrink:   0,
                        minWidth:     34,
                      }}>
                        <div style={{ color, fontSize: 13, fontWeight: 700, lineHeight: 1 }}>
                          {new Date(evt.starts_at).getDate()}
                        </div>
                        <div style={{ color, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {new Date(evt.starts_at).toLocaleDateString('en-IN', { month: 'short' })}
                        </div>
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
                          {isLive && (
                            <span style={{
                              background: 'rgba(74,222,128,0.15)',
                              border: '1px solid rgba(74,222,128,0.3)',
                              color: '#4ade80', borderRadius: 3,
                              padding: '0px 4px', fontSize: 8, fontWeight: 700,
                            }}>● LIVE</span>
                          )}
                          <i className={`fas ${typeIcon}`} style={{ color: 'var(--text-muted)', fontSize: 8 }} />
                          <span style={{ color: 'var(--text-muted)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {(evt.event_type || 'general').replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div style={{
                          color:        'var(--text)',
                          fontSize:     11,
                          fontWeight:   600,
                          overflow:     'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace:   'nowrap',
                          marginBottom: 2,
                        }}>
                          {evt.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>
                            <i className="fas fa-clock" style={{ marginRight: 3, fontSize: 8 }} />
                            {fmtDate(evt.starts_at)} · {fmtTime(evt.starts_at)}
                          </span>
                          {evt.is_virtual && (
                            <span style={{ color: '#60a5fa', fontSize: 9 }}>
                              <i className="fas fa-video" style={{ marginRight: 3, fontSize: 8 }} />
                              Virtual
                            </span>
                          )}
                          {evt.rsvp_enabled && (
                            <span style={{
                              background: `${color}15`, border: `1px solid ${color}30`,
                              color, borderRadius: 3, padding: '0px 4px',
                              fontSize: 8, fontWeight: 700,
                            }}>
                              RSVP
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Small reusable pieces ──────────────────────────────────────────────────

function Pill({ count, color, label }) {
  return (
    <span style={{
      background:   `${color}18`,
      border:       `1px solid ${color}33`,
      color,
      borderRadius: 10,
      padding:      '1px 7px',
      fontSize:     10,
      fontWeight:   700,
      whiteSpace:   'nowrap',
    }}>
      {count} {label}{count !== 1 ? 's' : ''}
    </span>
  );
}

function headerBtnStyle(color) {
  return {
    background:   'none',
    border:       '1px solid var(--border)',
    color,
    borderRadius: 5,
    padding:      '3px 8px',
    fontSize:     10,
    fontWeight:   600,
    cursor:       'pointer',
    display:      'flex',
    alignItems:   'center',
    whiteSpace:   'nowrap',
  };
}
