import React from 'react';

const Sidebar = ({ config, activeNav, onNavChange, onNewChat, onHistoryClick, isOpen }) => {
  const { navigation, recentChats, labels, app } = config;

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`} aria-label="Sidebar navigation">

      {/* ── New Chat ────────────────────────────────────────── */}
      <div className="sidebar-section" style={{ paddingTop: '16px' }}>
        <button className="new-chat-btn" onClick={onNewChat}>
          <i className="fas fa-edit" />
          <span>{labels.newChat}</span>
        </button>
      </div>

      {/* ── Features ────────────────────────────────────────── */}
      <div className="sidebar-section">
        <p className="sidebar-section-label">{labels.features}</p>
        {navigation.map((item) => (
          <div
            key={item.id}
            className={`sidebar-nav-item${activeNav === item.id ? ' active' : ''}`}
            onClick={() => onNavChange(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavChange(item.id)}
          >
            <i className={`fas ${item.icon}`} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Today ───────────────────────────────────────────── */}
      <div className="sidebar-section">
        <p className="sidebar-section-label">{labels.today}</p>
        {recentChats.today.map((chat, i) => (
          <div
            key={i}
            className="sidebar-history-item"
            onClick={() => onHistoryClick(chat)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onHistoryClick(chat)}
          >
            {chat}
          </div>
        ))}
      </div>

      {/* ── Yesterday ───────────────────────────────────────── */}
      <div className="sidebar-section">
        <p className="sidebar-section-label">{labels.yesterday}</p>
        {recentChats.yesterday.map((chat, i) => (
          <div
            key={i}
            className="sidebar-history-item"
            onClick={() => onHistoryClick(chat)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onHistoryClick(chat)}
          >
            {chat}
          </div>
        ))}
      </div>

      {/* ── Project info footer ─────────────────────────────── */}
      <div className="sidebar-project-card">
        <div className="sidebar-project-logo">
          <i className="fas fa-robot" />
        </div>
        <div className="sidebar-project-info">
          <p className="sidebar-project-name">{app.name}</p>
          <p className="sidebar-project-subtitle">{app.subtitle}</p>
        </div>
        <div className="sidebar-project-meta">
          <span className="sidebar-version-badge">{app.version}</span>
          <span className="sidebar-team-badge">{app.team}</span>
        </div>
      </div>

    </aside>
  );
};

export default Sidebar;
