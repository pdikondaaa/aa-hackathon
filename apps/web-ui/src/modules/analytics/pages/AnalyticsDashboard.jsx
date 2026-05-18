import React, { useState, useRef } from 'react';
import { useAnalyticsData }   from '../hooks/useAnalyticsData';
import OverviewCards           from '../components/OverviewCards';
import TabsBarChart            from '../components/TabsBarChart';
import DailyLineChart          from '../components/DailyLineChart';
import QueryPieChart           from '../components/QueryPieChart';
import ActiveUsersAreaChart    from '../components/ActiveUsersAreaChart';
import PeakHoursBarChart       from '../components/PeakHoursBarChart';
import SuccessFailedChart      from '../components/SuccessFailedChart';
import TopQueriesTable         from '../components/TopQueriesTable';
import RecentActivities        from '../components/RecentActivities';
import DateRangeFilter         from '../components/DateRangeFilter';
import ChatWindow              from '../../../components/ChatWindow';
import { chatConfig }          from '../../../config/chatConfig';

const ANALYTICS_CHAT_CONFIG = {
  ...chatConfig,
  messages: [],
  suggestions: [
    'What are the top queries users ask?',
    'Show me peak usage hours',
    'How many active users this week?',
    'Which features are most used?',
    'What is the query success rate?',
    'Show recent chatbot activity',
  ],
  labels: {
    ...chatConfig.labels,
    inputPlaceholder: 'Ask about analytics...',
    welcomeTitle: 'Aura Assistant ✨',
    welcomeSubtitle: 'What Would You Like to Know?',
    welcomeBodyText: 'Ask me anything about your AURA analytics — usage trends, top queries, active users, peak hours, and more.',
  },
};

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`an-card ${className}`}>
      <div className="an-card-header">
        <div>
          <div className="an-card-title">{title}</div>
          {subtitle && <div className="an-card-subtitle">{subtitle}</div>}
        </div>
      </div>
      <div className="an-card-body">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="an-skeleton-wrap">
      <div className="an-skeleton an-skeleton-overview" />
      <div className="an-skeleton-row">
        <div className="an-skeleton an-skeleton-chart" />
        <div className="an-skeleton an-skeleton-chart" />
      </div>
      <div className="an-skeleton-row">
        <div className="an-skeleton an-skeleton-chart" />
        <div className="an-skeleton an-skeleton-chart" />
      </div>
      <div className="an-skeleton an-skeleton-table" />
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="an-error-state">
      <i className="fas fa-triangle-exclamation an-error-icon" />
      <div className="an-error-title">Failed to load analytics</div>
      <div className="an-error-msg">{message}</div>
      <button className="an-retry-btn" onClick={onRetry}>
        <i className="fas fa-rotate-right" /> Retry
      </button>
    </div>
  );
}

export default function AnalyticsDashboard({ user }) {
  const [dateRange, setDateRange]   = useState('week');
  const [chatOpen, setChatOpen]     = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [fabPos, setFabPos]         = useState(null);
  const chatKeyRef                  = useRef(Date.now());
  const dragRef                     = useRef({ dragging: false, moved: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });
  const { data, loading, error, refetch } = useAnalyticsData(dateRange);

  const handleFabPointerDown = (e) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleFabPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    if (!d.moved) e.currentTarget.setAttribute('data-dragging', '');
    d.moved = true;
    setFabPos({
      left: Math.max(0, Math.min(window.innerWidth - e.currentTarget.offsetWidth, d.startLeft + dx)),
      top:  Math.max(0, Math.min(window.innerHeight - e.currentTarget.offsetHeight, d.startTop + dy)),
    });
  };

  const handleFabPointerUp = (e) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    e.currentTarget.removeAttribute('data-dragging');
    if (!d.moved) {
      if (chatOpen) {
        setChatOpen(false);
      } else {
        if (!chatMounted) setChatMounted(true);
        setChatOpen(true);
        setTimeout(() => {
          if (ChatWindow.setSuggestion) {
            ChatWindow.setSuggestion('Help me understand the Analytics Dashboard metrics');
          }
        }, 150);
      }
    }
  };

  const handleExportCSV = () => {
    if (!data.topQueries?.length) return;
    const headers = ['#', 'Query', 'Hit Count', 'Last Used', 'Success Rate'];
    const rows = data.topQueries.map((q, i) =>
      [i + 1, `"${q.query}"`, q.hits, q.lastUsed, `${q.successRate}%`].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aura-analytics-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="analytics-page" style={{ position: 'relative' }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="an-page-header">
        <div className="an-page-title-wrap">
          <div className="an-page-icon">
            <i className="fas fa-chart-bar" />
          </div>
          <div>
            <h1 className="an-page-title">Analytics Dashboard</h1>
            <p className="an-page-subtitle">
              AURA usage insights &amp; performance metrics
              {user?.name && <span className="an-page-user"> · {user.name}</span>}
            </p>
          </div>
        </div>

        <div className="an-header-actions">
          <DateRangeFilter value={dateRange} onChange={(r) => setDateRange(r)} />
          <button className="an-export-btn" onClick={handleExportCSV} title="Export top queries to CSV">
            <i className="fas fa-download" /> Export CSV
          </button>
          <button className="an-refresh-btn" onClick={refetch} title="Refresh data">
            <i className={`fas fa-rotate-right${loading ? ' fa-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="an-content">

          {/* Overview KPI Cards */}
          <section className="an-section">
            <OverviewCards stats={data.overviewStats} />
          </section>

          {/* Row 1: Daily Usage + Active Users Trend */}
          <section className="an-section an-charts-row">
            <ChartCard
              title="Daily Usage"
              subtitle="Queries & active users over time"
              className="an-card-wide"
            >
              <DailyLineChart data={data.dailyUsage} />
            </ChartCard>

          </section>

          {/* Row 2: Most Used Tabs + Query Categories */}
          <section className="an-section an-charts-row">
            <ChartCard
              title="Most Used Features"
              subtitle="Query volume by tab / assistant"
            >
              <TabsBarChart data={data.mostUsedTabs} />
            </ChartCard>

            <ChartCard
              title="Query Categories"
              subtitle="Distribution by topic"
            >
              <QueryPieChart data={data.queryCategories} />
            </ChartCard>
          </section>

          {/* Row 3: Peak Hours + Success vs Failed */}
          <section className="an-section an-charts-row">
            <ChartCard
              title="Peak Usage Hours"
              subtitle="Busiest times of day (dashed = peak)"
            >
              <PeakHoursBarChart data={data.peakUsageHours} />
            </ChartCard>

            <ChartCard
              title="Query Success vs Failed"
              subtitle="Last 7 days reliability"
            >
              <SuccessFailedChart data={data.successVsFailed} />
            </ChartCard>
          </section>

          {/* Row 4: Top Queries Table */}
          <section className="an-section">
            <ChartCard
              title="Top Queries"
              subtitle="Most frequently asked questions"
            >
              <TopQueriesTable queries={data.topQueries} />
            </ChartCard>
          </section>

          {/* Row 5: Recent Activities */}
          <section className="an-section">
            <ChartCard
              title="Recent Activities"
              subtitle="Latest chatbot interactions across AURA"
            >
              <RecentActivities activities={data.recentActivities} />
            </ChartCard>
          </section>

        </div>
      )}

      {/* ── Floating Ask Aura button ──────────────────────────────── */}
      <button
        className={`og-chat-fab${chatOpen ? ' og-chat-fab--open' : ''}`}
        style={fabPos ? { top: fabPos.top, left: fabPos.left, bottom: 'auto', right: 'auto' } : undefined}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        aria-label={chatOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}
      >
        <i className={`fas ${chatOpen ? 'fa-times' : 'fa-robot'}`} />
        {!chatOpen && <span>Ask Aura</span>}
      </button>

      {/* ── Analytics chat drawer ─────────────────────────────────── */}
      <div className={`og-chat-drawer${chatOpen ? ' og-chat-drawer--open' : ''}`} aria-hidden={!chatOpen}>
        <div className="og-chat-drawer-header">
          <div className="og-chat-drawer-title">
            <i className="fas fa-chart-line" />
            <span>Aura Assistant</span>
          </div>
          <button className="og-chat-drawer-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="og-chat-drawer-body">
          {chatMounted && <ChatWindow key={chatKeyRef.current} config={ANALYTICS_CHAT_CONFIG} user={user} compact />}
        </div>
      </div>
    </main>
  );
}
