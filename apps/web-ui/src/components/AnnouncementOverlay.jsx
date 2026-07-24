import React, { useState, useEffect, useCallback } from 'react';
import { getActiveAnnouncements } from '../services/api';

const PRIORITY_ACCENT = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#60a5fa',
  low:      '#4ade80',
};

const PRIORITY_ICON = {
  critical: 'fa-circle-exclamation',
  high:     'fa-triangle-exclamation',
  medium:   'fa-circle-info',
  low:      'fa-circle-check',
};

export default function AnnouncementOverlay({ user }) {
  const [queue,   setQueue]   = useState([]);
  const [idx,     setIdx]     = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadeIn,  setFadeIn]  = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await getActiveAnnouncements();
      // Show overlay/carousel announcements on every load — dismissals are session-only
      // (in-memory state), so they reappear on the next page refresh.
      const overlays = all.filter(
        (a) => a.display_mode === 'overlay' || a.display_mode === 'carousel'
      );
      if (overlays.length > 0) {
        setQueue(overlays);
        setIdx(0);
        setVisible(true);
        setTimeout(() => setFadeIn(true), 30);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Dismissal is session-only: removes from local state, no DB write.
  // On next page reload the announcement reappears.
  const close = () => {
    const ann = queue[idx];
    setFadeIn(false);
    setTimeout(() => {
      const next = queue.filter((q) => q.id !== ann.id);
      if (next.length === 0) {
        setVisible(false);
        setQueue([]);
      } else {
        setQueue(next);
        setIdx(0);
        setTimeout(() => setFadeIn(true), 30);
      }
    }, 280);
  };

  const goNext = () => {
    setFadeIn(false);
    setTimeout(() => {
      setIdx((i) => (i + 1) % queue.length);
      setFadeIn(true);
    }, 200);
  };

  const goPrev = () => {
    setFadeIn(false);
    setTimeout(() => {
      setIdx((i) => (i - 1 + queue.length) % queue.length);
      setFadeIn(true);
    }, 200);
  };

  if (!visible || queue.length === 0) return null;

  const ann    = queue[idx];
  const accent = PRIORITY_ACCENT[ann.priority] || PRIORITY_ACCENT.medium;
  const icon   = PRIORITY_ICON[ann.priority]   || PRIORITY_ICON.medium;

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         900,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     `rgba(0,0,0,${fadeIn ? 0.6 : 0})`,
        transition:     'background 0.28s ease',
        backdropFilter: fadeIn ? 'blur(4px)' : 'none',
        padding:        '20px 16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        style={{
          background:   'var(--bg-card)',
          border:       `1px solid ${accent}33`,
          borderRadius: 20,
          width:        '100%',
          maxWidth:     540,
          boxShadow:    `0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px ${accent}22`,
          overflow:     'hidden',
          opacity:      fadeIn ? 1 : 0,
          transform:    fadeIn ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(16px)',
          transition:   'opacity 0.28s ease, transform 0.28s ease',
        }}
      >
        {/* Gradient header bar */}
        <div style={{
          background:  `linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%)`,
          borderBottom: `1px solid ${accent}22`,
          padding:      '24px 28px 20px',
          position:     'relative',
        }}>
          {ann.banner_image_url && (
            <div style={{
              width: '100%', height: 160, marginBottom: 16,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <img
                src={ann.banner_image_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${accent}22`,
              border:     `1px solid ${accent}44`,
              display:    'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <i className={`fas ${icon}`} style={{ color: accent, fontSize: 18 }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <PriorityBadge priority={ann.priority} accent={accent} />
                {queue.length > 1 && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {idx + 1} of {queue.length}
                  </span>
                )}
              </div>
              <h2 style={{
                color:      'var(--text)',
                fontSize:   18,
                fontWeight: 700,
                margin:     0,
                lineHeight: 1.3,
              }}>
                {ann.title}
              </h2>
            </div>

            {/* Always show close — users should never be trapped in the overlay */}
            <button
              onClick={() => close()}
              style={{
                background:   'none',
                border:       'none',
                color:        'var(--text-muted)',
                cursor:       'pointer',
                padding:      4,
                fontSize:     16,
                lineHeight:   1,
                borderRadius: 6,
                transition:   'color 0.2s',
              }}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 28px' }}>
          <p style={{
            color:      'var(--text-secondary)',
            fontSize:   14,
            lineHeight: 1.65,
            margin:     0,
            whiteSpace: 'pre-wrap',
          }}>
            {ann.message}
          </p>

          {ann.rich_content && (
            <div
              style={{
                marginTop:  12,
                color:      'var(--text-secondary)',
                fontSize:   13,
                lineHeight: 1.6,
              }}
              dangerouslySetInnerHTML={{ __html: ann.rich_content }}
            />
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          padding:        '16px 28px 24px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          gap:            12,
          borderTop:      '1px solid var(--border-light)',
        }}>
          {/* Multi-overlay navigation */}
          {queue.length > 1 ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <NavBtn onClick={goPrev} icon="fa-chevron-left" />
              <NavBtn onClick={goNext} icon="fa-chevron-right" />
            </div>
          ) : <div />}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => close()}
              style={{
                background:   'var(--bg-elevated)',
                border:       '1px solid var(--border)',
                color:        'var(--text-secondary)',
                borderRadius: 8,
                padding:      '8px 18px',
                fontSize:     13,
                fontWeight:   500,
                cursor:       'pointer',
              }}
            >
              Dismiss
            </button>

            {ann.cta_label && (
              <button
                onClick={() => {
                  if (ann.cta_url) {
                    window.open(ann.cta_url, '_blank', 'noopener noreferrer');
                  }
                  close();
                }}
                style={{
                  background:   accent,
                  border:       'none',
                  color:        '#000',
                  borderRadius: 8,
                  padding:      '8px 20px',
                  fontSize:     13,
                  fontWeight:   700,
                  cursor:       'pointer',
                  boxShadow:    `0 4px 12px ${accent}55`,
                }}
              >
                {ann.cta_label}
              </button>
            )}

            {!ann.cta_label && (
              <button
                onClick={() => close()}
                style={{
                  background:   accent,
                  border:       'none',
                  color:        '#000',
                  borderRadius: 8,
                  padding:      '8px 20px',
                  fontSize:     13,
                  fontWeight:   700,
                  cursor:       'pointer',
                  boxShadow:    `0 4px 12px ${accent}55`,
                }}
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority, accent }) {
  const labels = { critical: 'CRITICAL', high: 'URGENT', medium: 'ANNOUNCEMENT', low: 'NOTE' };
  return (
    <span style={{
      background:    `${accent}22`,
      border:        `1px solid ${accent}44`,
      color:         accent,
      borderRadius:  4,
      padding:       '2px 8px',
      fontSize:      10,
      fontWeight:    700,
      letterSpacing: '0.08em',
    }}>
      {labels[priority] || 'INFO'}
    </span>
  );
}

function NavBtn({ onClick, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   'var(--bg-elevated)',
        border:       '1px solid var(--border)',
        color:        'var(--text-secondary)',
        borderRadius: 6,
        width:        32,
        height:       32,
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontSize:     12,
      }}
    >
      <i className={`fas ${icon}`} />
    </button>
  );
}
