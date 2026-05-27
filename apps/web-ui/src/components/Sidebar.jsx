import React, { useState, useEffect } from 'react';
import { listConversations, deleteConversation } from '../services/api';

const ALLOCATION_BOARD_ROLES = new Set(['team_lead', 'functional_lead', 'business_lead', 'executive', 'admin']);
const COO_ANALYTICS_ROLES    = new Set(['business_lead', 'executive', 'admin']);

const Sidebar = ({ config, activeNav, onNavChange, onNewChat, onHistoryClick, onDeleteConversation, isOpen, refreshKey, selectedConversationId, allocationRole }) => {
  const { navigation, labels, app } = config;

  const visibleNav = navigation.filter(item => {
    if (item.id === 'allocationBoard') return ALLOCATION_BOARD_ROLES.has(allocationRole);
    if (item.id === 'cooAnalytics')   return COO_ANALYTICS_ROLES.has(allocationRole);
    return true;
  });
  const [conversations, setConversations] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistLoading(true);
      try {
        const res = await listConversations(1, 50);
        if (!cancelled) setConversations(res.data || []);
      } catch (e) {
        console.error('Failed to load conversations:', e);
      } finally {
        if (!cancelled) setHistLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const groupByDate = (convs) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const groups = { today: [], yesterday: [], older: [] };
    for (const conv of convs) {
      const d = new Date(conv.updated_at);
      d.setHours(0, 0, 0, 0);
      if (d >= todayStart) groups.today.push(conv);
      else if (d >= yesterdayStart) groups.yesterday.push(conv);
      else groups.older.push(conv);
    }
    return groups;
  };

  const groups = groupByDate(conversations);

  const handleDelete = async (e, conv) => {
    e.stopPropagation();
    if (deletingId === conv.id) return;
    setDeletingId(conv.id);
    try {
      await deleteConversation(conv.id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (onDeleteConversation) onDeleteConversation(conv.id);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const renderGroup = (label, items) => {
    if (!items.length) return null;
    return (
      <div className="sidebar-section" key={label}>
        <p className="sidebar-section-label">{label}</p>
        {items.map((conv) => (
          <div
            key={conv.id}
            className={`sidebar-history-item${selectedConversationId === conv.id ? ' active' : ''}`}
            onClick={() => onHistoryClick(conv)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onHistoryClick(conv)}
            title={conv.title}
          >
            <span className="sidebar-history-item-title">{conv.title || 'Untitled'}</span>
            <button
              className="sidebar-history-delete-btn"
              onClick={(e) => handleDelete(e, conv)}
              title="Delete conversation"
              aria-label="Delete conversation"
              tabIndex={-1}
            >
              {deletingId === conv.id
                ? <i className="fas fa-spinner fa-spin" />
                : <i className="fas fa-times" />}
            </button>
          </div>
        ))}
      </div>
    );
  };

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
        {visibleNav.map((item) => (
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

      {/* ── Conversation history ─────────────────────────────── */}
      {histLoading ? (
        <div className="sidebar-section">
          <p className="sidebar-section-label" style={{ opacity: 0.5 }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />
            Loading...
          </p>
        </div>
      ) : (
        <>
          {renderGroup(labels.today || 'Today', groups.today)}
          {renderGroup(labels.yesterday || 'Yesterday', groups.yesterday)}
          {renderGroup('Older', groups.older)}
          {conversations.length === 0 && (
            <div className="sidebar-section">
              <p className="sidebar-section-label" style={{ opacity: 0.4 }}>No conversations yet</p>
            </div>
          )}
        </>
      )}

      {/* ── Project info footer ─────────────────────────────── */}
      <div className="sidebar-project-card">
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
