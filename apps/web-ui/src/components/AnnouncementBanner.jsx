import React, { useState, useEffect, useCallback } from 'react';
import { getActiveAnnouncements } from '../services/api';

const PRIORITY_CONFIG = {
  critical: { bg: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)', accent: '#fca5a5', icon: 'fa-circle-exclamation', label: 'CRITICAL' },
  high:     { bg: 'linear-gradient(135deg, #78350f 0%, #92400e 100%)', accent: '#fcd34d', icon: 'fa-triangle-exclamation', label: 'URGENT' },
  medium:   { bg: 'linear-gradient(135deg, #1e3a5f 0%, #1D76BC 100%)', accent: '#93c5fd', icon: 'fa-circle-info',         label: 'INFO' },
  low:      { bg: 'linear-gradient(135deg, #14532d 0%, #166534 100%)', accent: '#86efac', icon: 'fa-circle-check',        label: 'NOTE' },
};

export default function AnnouncementBanner({ user }) {
  const [banners, setBanners]   = useState([]);
  const [current, setCurrent]   = useState(0);
  const [visible, setVisible]   = useState(false);
  const [exiting, setExiting]   = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await getActiveAnnouncements();
      // Show banner-mode announcements on every load — dismissals are session-only
      // (in-memory state), so they reappear on the next page refresh.
      const filtered = all.filter((a) => a.display_mode === 'banner' || a.display_mode === 'inline');
      setBanners(filtered);
      setVisible(filtered.length > 0);
      setCurrent(0);
    } catch (_) {}
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Auto-hide for the current banner
  useEffect(() => {
    const b = banners[current];
    if (!b?.auto_hide_seconds) return;
    const t = setTimeout(() => handleDismiss(b), b.auto_hide_seconds * 1000);
    return () => clearTimeout(t);
  }, [current, banners]);

  const handleDismiss = (banner) => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setBanners((prev) => {
        const next = prev.filter((b) => b.id !== banner.id);
        if (next.length === 0) setVisible(false);
        setCurrent(0);
        return next;
      });
    }, 300);
  };

  const handleCTA = (banner) => {
    if (banner.cta_url) {
      window.open(banner.cta_url, '_blank', 'noopener noreferrer');
    }
    handleDismiss(banner);
  };

  if (!visible || banners.length === 0) return null;

  const banner = banners[current];
  const cfg    = PRIORITY_CONFIG[banner.priority] || PRIORITY_CONFIG.medium;

  return (
    <div
      style={{
        background:  cfg.bg,
        transition:  'opacity 0.3s ease, transform 0.3s ease',
        opacity:     exiting ? 0 : 1,
        transform:   exiting ? 'translateY(-8px)' : 'translateY(0)',
        display:     'flex',
        alignItems:  'center',
        gap:         12,
        padding:     '10px 20px',
        fontSize:    13,
        position:    'relative',
        zIndex:      400,
        minHeight:   48,
        flexShrink:  0,
      }}
    >
      {/* Priority badge */}
      <span style={{
        background:    `${cfg.accent}22`,
        border:        `1px solid ${cfg.accent}44`,
        color:         cfg.accent,
        borderRadius:  4,
        padding:       '2px 8px',
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: '0.08em',
        whiteSpace:    'nowrap',
        flexShrink:    0,
      }}>
        <i className={`fas ${cfg.icon}`} style={{ marginRight: 4 }} />
        {cfg.label}
      </span>

      {/* Message */}
      <span style={{ color: '#fff', flex: 1, lineHeight: 1.4, fontWeight: 500 }}>
        <strong>{banner.title}</strong>
        {banner.message && (
          <span style={{ opacity: 0.85, marginLeft: 8, fontWeight: 400 }}>
            {banner.message}
          </span>
        )}
      </span>

      {/* Multi-banner navigation */}
      {banners.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => setCurrent((c) => (c - 1 + banners.length) % banners.length)}
            style={navBtnStyle}
          ><i className="fas fa-chevron-left" /></button>
          <span style={{ color: cfg.accent, fontSize: 11 }}>
            {current + 1} / {banners.length}
          </span>
          <button
            onClick={() => setCurrent((c) => (c + 1) % banners.length)}
            style={navBtnStyle}
          ><i className="fas fa-chevron-right" /></button>
        </div>
      )}

      {/* CTA button */}
      {banner.cta_label && (
        <button
          onClick={() => handleCTA(banner)}
          style={{
            background:   `${cfg.accent}22`,
            border:       `1px solid ${cfg.accent}55`,
            color:        cfg.accent,
            borderRadius: 6,
            padding:      '4px 14px',
            fontSize:     12,
            fontWeight:   600,
            cursor:       'pointer',
            flexShrink:   0,
            transition:   'background 0.2s',
          }}
        >
          {banner.cta_label}
        </button>
      )}

      {/* Dismiss — always visible so users are never stuck */}
      <button
        onClick={() => handleDismiss(banner)}
        title="Dismiss"
        style={{
          background:   'none',
          border:       'none',
          color:        `${cfg.accent}99`,
          cursor:       'pointer',
          padding:      '4px 6px',
          fontSize:     14,
          flexShrink:   0,
          lineHeight:   1,
        }}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}

const navBtnStyle = {
  background:   'none',
  border:       'none',
  color:        '#ffffff88',
  cursor:       'pointer',
  padding:      '2px 4px',
  fontSize:     11,
  lineHeight:   1,
};
