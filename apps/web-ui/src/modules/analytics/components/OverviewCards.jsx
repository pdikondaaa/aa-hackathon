import React from 'react';

function StatCard({ stat }) {
  return (
    <div className="an-stat-card">
      <div className="an-stat-icon-wrap" style={{ background: stat.color + '22', color: stat.color }}>
        <i className={`fas ${stat.icon}`} />
      </div>
      <div className="an-stat-body">
        <div className="an-stat-value">
          {stat.value.toLocaleString?.() ?? stat.value}{stat.suffix}
        </div>
        <div className="an-stat-label">{stat.label}</div>
        <div className={`an-stat-delta ${stat.positive ? 'positive' : 'negative'}`}>
          <i className={`fas fa-arrow-${stat.positive ? 'up' : 'down'}`} />
          {stat.delta}
        </div>
      </div>
      <div className="an-stat-accent" style={{ background: stat.color }} />
    </div>
  );
}

export default function OverviewCards({ stats }) {
  if (!stats?.length) return null;
  return (
    <div className="an-overview-grid">
      {stats.map((stat) => (
        <StatCard key={stat.id} stat={stat} />
      ))}
    </div>
  );
}
