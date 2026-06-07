import React, { useState, useRef, useEffect } from 'react';
import alignedDarkLogo  from '../assets/alignedDarkLogo.svg';
import alignedLightLogo from '../assets/alignedLightLogo.svg';
import AlignedLogo     from '../assets/AlignedLogo.png';
import { QUICK_LINKS } from '../config/quickLinksConfig';

const TopBar = ({
  config,
  user,
  sidebarOpen,    onSidebarToggle,
  rightPanelOpen, onRightPanelToggle,
  isDark,         onThemeToggle,
  onLogout,
  onGoHome,
}) => {
  const displayUser = user || config.user;
  const logo = isDark ? alignedDarkLogo : alignedLightLogo;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [qlOpen, setQlOpen]       = useState(false);
  const [qlClosing, setQlClosing] = useState(false);
  const [imgErrors, setImgErrors] = useState(new Set());
  const qlRef = useRef(null);

  // Determine what to render inside a link's icon tile
  const renderLinkIcon = (link) => {
    // Aligned Automation: always use the locally-bundled logo
    if (link.id === 'aa-website') {
      return (
        <img
          src={isDark ? AlignedLogo : AlignedLogo}
          alt=""
          className="ql-link-img"
        />
      );
    }
    // Services with an external image — fall back to FA on network error
    if (link.iconImg && !imgErrors.has(link.id)) {
      return (
        <img
          src={link.iconImg}
          alt=""
          className="ql-link-img"
          onError={() => setImgErrors((prev) => new Set([...prev, link.id]))}
        />
      );
    }
    // FA icon fallback
    return <i className={`fas ${link.icon}`} style={{ color: link.color }} />;
  };

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close Quick Links drawer on outside click
  useEffect(() => {
    if (!qlOpen) return;
    const handler = (e) => {
      if (qlRef.current && !qlRef.current.contains(e.target)) {
        triggerClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [qlOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerClose = () => {
    setQlClosing(true);
    setTimeout(() => {
      setQlClosing(false);
      setQlOpen(false);
    }, 240);
  };

  const handleQlClick = () => {
    if (qlOpen && !qlClosing) triggerClose();
    else if (!qlOpen) setQlOpen(true);
  };

  return (
    <header className="topbar">

      {/* ── Brand + sidebar toggle ────────────────────────── */}
      <div className="topbar-brand">
        <button
          className={`topbar-icon-btn topbar-sidebar-btn${sidebarOpen ? ' panel-active' : ''}`}
          onClick={onSidebarToggle}
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <i className={`fas ${sidebarOpen ? 'fa-indent' : 'fa-outdent'}`} />
        </button>
        <img
          src={logo}
          alt="Aligned Automation"
          onClick={onGoHome}
          className="topbar-logo-img"
          draggable={false}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Right actions ─────────────────────────────────── */}
      <div className="topbar-actions">

        {/* ── Quick Links ──────────────────────────────────── */}
        <div
          className="ql-wrapper"
          ref={qlRef}
        >
          <button
            className={`topbar-icon-btn${qlOpen ? ' panel-active' : ''}`}
            onClick={handleQlClick}
            title="Quick Links"
            aria-label="Quick Links"
            aria-expanded={qlOpen}
          >
            <i className="fas fa-th" />
          </button>

          {(qlOpen || qlClosing) && (
            <div
              className={`ql-drawer${qlClosing ? ' ql-drawer--closing' : ''}`}
            >
              <div className="ql-grid">
                {QUICK_LINKS.map((link, i) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ql-link"
                    style={{ '--delay': `${i * 0.05 + 0.08}s`, '--accent': link.color }}
                    onClick={() => qlOpen && !qlClosing && triggerClose()}
                  >
                    <span
                      className="ql-link-icon"
                      style={{ background: link.color + '20' }}
                    >
                      {renderLinkIcon(link)}
                    </span>
                    <span className="ql-link-label">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          className="topbar-icon-btn"
          onClick={onThemeToggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`} />
        </button>

        {/* Right panel toggle */}
        <button
          className={`topbar-icon-btn topbar-panel-btn${rightPanelOpen ? ' panel-active' : ''}`}
          onClick={onRightPanelToggle}
          aria-label={rightPanelOpen ? 'Hide overview panel' : 'Show overview panel'}
          title={rightPanelOpen ? 'Hide overview panel' : 'Show overview panel'}
        >
          <i className="fas fa-table-columns" />
        </button>

        {/* ── User avatar + dropdown ───────────────────────── */}
        <div className="topbar-user-menu" ref={menuRef}>
          <button
            className="topbar-avatar"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={`User menu for ${displayUser.name}`}
            aria-expanded={menuOpen}
            title={displayUser.name}
          >
            {displayUser.photo
              ? <img src={displayUser.photo} alt={displayUser.name} className="topbar-avatar-photo" />
              : displayUser.initials}
          </button>

          {menuOpen && (
            <div className="topbar-user-dropdown" role="menu">
              <div className="topbar-user-info">
                {displayUser.photo && (
                  <img src={displayUser.photo} alt={displayUser.name} className="topbar-dropdown-photo" />
                )}
                <span className="topbar-user-name">{displayUser.name}</span>
                {displayUser.email && (
                  <span className="topbar-user-email">{displayUser.email}</span>
                )}
              
              </div>
              <hr className="topbar-dropdown-divider" />
              <button
                className="topbar-dropdown-item topbar-dropdown-signout"
                onClick={() => { setMenuOpen(false); onLogout?.(); }}
                role="menuitem"
              >
                <i className="fas fa-sign-out-alt" />
                Sign out
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default TopBar;
