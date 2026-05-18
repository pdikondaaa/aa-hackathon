import React, { useState, useEffect } from 'react';
import { chatConfig } from './config/chatConfig';
import {
  initializeMsal, getCachedAccount,
  loginWithRedirect, logout,
  fetchUserProfile, buildUser,
  checkUserAuthorization, getUserInfo,
} from './utils/authService';
import TopBar             from './components/TopBar';
import Sidebar            from './components/Sidebar';
import ChatWindow         from './components/ChatWindow';
import RightPanel         from './components/RightPanel';
import PersonalNotes      from './components/PersonalNotes';
import LoginPage          from './components/LoginPage';
import EscalationDrawer   from './components/EscalationDrawer';
import DocumentsPage      from './components/DocumentsPage';
import EmailAgentPage     from './components/EmailAgentPage';
import { OnboardingGuidancePage } from './modules/onboarding-guidance';
import { AnalyticsDashboard }     from './modules/analytics';

const SIDEBAR_BREAKPOINT = 900;

// Extracted to reduce cognitive complexity of the auth useEffect
async function restoreSession(setUser, setAuthError, setAuthLoading) {
  try {
    await initializeMsal();
    const account = getCachedAccount();
    if (!account) return;

    const profile   = await fetchUserProfile();
    const userEmail = profile.mail || profile.userPrincipalName || '';

    if (!checkUserAuthorization(userEmail)) {
      setAuthError("You don't have access for this app. Please contact the Project Aura Team for access.");
      await logout();
      return;
    }

    const userInfo = getUserInfo(userEmail);
    setUser({
      ...buildUser(profile),
      role:            userInfo.role,
      permissions:     userInfo.permissions,
      availableAgents: userInfo.availableAgents,
      isAdmin:         userInfo.isAdmin,
    });
  } catch (err) {
    console.error('Auth error:', err);
  } finally {
    setAuthLoading(false);
  }
}

export default function App() {
  const [activeNav,             setActiveNav]             = useState(chatConfig.navigation[0].id);
  const [sidebarOpen,           setSidebarOpen]           = useState(window.innerWidth > SIDEBAR_BREAKPOINT);
  const [rightPanelOpen,        setRightPanelOpen]        = useState(false);
  const [chatKey,               setChatKey]               = useState(0);
  const [isDark,                setIsDark]                = useState(false);
  const [escalationOpen,        setEscalationOpen]        = useState(false);
  const [escalationContext,     setEscalationContext]     = useState({ conversationId: null, messageId: null });
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [sidebarRefreshKey,     setSidebarRefreshKey]     = useState(0);
  const [user,                  setUser]                  = useState(null);
  const [authLoading,           setAuthLoading]           = useState(true);
  const [authError,             setAuthError]             = useState(null);

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const t = isDark ? chatConfig.theme : chatConfig.lightTheme;
    const f = chatConfig.fonts;
    const vars = {
      '--bg':             t.bg,
      '--bg-secondary':   t.bgSecondary,
      '--bg-elevated':    t.bgElevated,
      '--bg-card':        t.bgCard,
      '--border':         t.border,
      '--border-light':   t.borderLight,
      '--primary':        t.primary,
      '--primary-hover':  t.primaryHover,
      '--light-blue':     t.lightBlue,
      '--deep-blue':      t.deepBlue,
      '--secondary':      t.secondary,
      '--text':           t.text,
      '--text-secondary': t.textSecondary,
      '--text-muted':     t.textMuted,
      '--success':        t.success,
      '--error':          t.error,
      '--warning':        t.warning,
      '--font':           f.family,
    };
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  // Restore MSAL session on mount
  useEffect(() => {
    restoreSession(setUser, setAuthError, setAuthLoading);
  }, []);

  // Auto-collapse sidebar when viewport narrows below breakpoint
  useEffect(() => {
    let prevWidth = window.innerWidth;
    const onResize = () => {
      const w = window.innerWidth;
      if (w <= SIDEBAR_BREAKPOINT && prevWidth > SIDEBAR_BREAKPOINT) {
        setSidebarOpen(false);
      }
      prevWidth = w;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await loginWithRedirect();
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed. Please try again.');
    }
  };

  const handleLogout = async () => {
    try { await logout(); } finally { setUser(null); }
  };

  const handleGoHome = () => {
    setActiveNav(chatConfig.navigation[0].id);
    setSelectedConversationId(null);
    setChatKey((k) => k + 1);
  };

  const handleHistoryClick = (conversation) => {
    setSelectedConversationId(conversation.id);
    setActiveNav(chatConfig.navigation[0].id);
  };

  // Extracted from nested ternary to a plain function
  const renderMainContent = () => {
    if (activeNav === 'documents')         return <DocumentsPage user={user} />;
    if (activeNav === 'analytics')         return <AnalyticsDashboard user={user} />;
    if (activeNav === 'myNotes')           return <PersonalNotes user={user} />;
    if (activeNav === 'onboardingGuidance') return <OnboardingGuidancePage user={user} config={chatConfig} />;
    if (activeNav === 'emailAgent')        return <EmailAgentPage user={user} />;
    return (
      <main className="main-content">
        <ChatWindow
          key={chatKey}
          config={chatConfig}
          user={user}
          selectedConversationId={selectedConversationId}
          onConversationUpdated={() => setSidebarRefreshKey((k) => k + 1)}
          onOpenEscalation={({ conversationId, messageId } = {}) => {
            setEscalationContext({ conversationId: conversationId ?? null, messageId: messageId ?? null });
            setEscalationOpen(true);
          }}
        />
      </main>
    );
  };

  if (authLoading) {
    return (
      <div className="auth-loading">
        <i className="fas fa-spinner fa-spin auth-loading-icon" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage isDark={isDark} onLogin={handleLogin} error={authError} />;
  }

  return (
    <div id="aura-app">
      <TopBar
        config={chatConfig}
        user={user}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        rightPanelOpen={rightPanelOpen}
        onRightPanelToggle={() => setRightPanelOpen((o) => !o)}
        isDark={isDark}
        onThemeToggle={() => setIsDark((d) => !d)}
        onLogout={handleLogout}
        onGoHome={handleGoHome}
      />

      <div className="app-layout">
        <Sidebar
          config={chatConfig}
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onNewChat={handleGoHome}
          onHistoryClick={handleHistoryClick}
          onDeleteConversation={(deletedId) => {
            if (selectedConversationId === deletedId) {
              setSelectedConversationId(null);
              setChatKey((k) => k + 1);
            }
          }}
          isOpen={sidebarOpen}
          refreshKey={sidebarRefreshKey}
          selectedConversationId={selectedConversationId}
        />

        {renderMainContent()}

        {rightPanelOpen && (
          <RightPanel
            config={chatConfig}
            onClose={() => setRightPanelOpen(false)}
          />
        )}
      </div>

      <EscalationDrawer
        isOpen={escalationOpen}
        onClose={() => setEscalationOpen(false)}
        user={user}
        conversationId={escalationContext.conversationId}
        messageId={escalationContext.messageId}
      />
    </div>
  );
}
