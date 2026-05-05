import React, { useState, useRef, useEffect } from 'react';
import alignedDarkLogo  from '../assets/alignedDarkLogo.svg';
import alignedLightLogo from '../assets/alignedLightLogo.svg';

const TopBar = ({
  config,
  user,
  sidebarOpen,    onSidebarToggle,
  rightPanelOpen, onRightPanelToggle,
  isDark,         onThemeToggle,
  onLogout,
}) => {
  const displayUser = user || config.user;
  const logo = isDark ? alignedDarkLogo : alignedLightLogo;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef   = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
          className="topbar-logo-img"
          draggable={false}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* ── Right actions ─────────────────────────────────── */}
      <div className="topbar-actions">

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
                {displayUser.jobTitle && (
                  <span className="topbar-user-role">{displayUser.jobTitle}</span>
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
