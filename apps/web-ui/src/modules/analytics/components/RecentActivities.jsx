import React from 'react';

const CATEGORY_COLORS = {
  HR:  '#1D76BC',
  IT:  '#27AAE1',
  Doc: '#4ED44E',
  Org: '#2A3D90',
};

const TYPE_ICONS = {
  query:      'fa-magnifying-glass',
  document:   'fa-file-lines',
  ticket:     'fa-ticket',
  escalation: 'fa-triangle-exclamation',
};

const STATUS_CONFIG = {
  success: { color: '#4ED44E', label: 'Success' },
  pending: { color: '#f59e0b', label: 'Pending' },
  failed:  { color: '#f05252', label: 'Failed'  },
};

function ActivityRow({ item }) {
  const catColor  = CATEGORY_COLORS[item.category] ?? '#a8bdd4';
  const typeIcon  = TYPE_ICONS[item.type] ?? 'fa-circle-dot';
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.success;

  return (
    <div className="an-activity-row">
      <div className="an-activity-icon" style={{ background: catColor + '22', color: catColor }}>
        <i className={`fas ${typeIcon}`} />
      </div>
      <div className="an-activity-body">
        <div className="an-activity-header">
          <span className="an-activity-user">{item.user}</span>
          <span className="an-activity-cat-badge" style={{ background: catColor + '22', color: catColor }}>
            {item.category}
          </span>
        </div>
        <div className="an-activity-action">{item.action}</div>
      </div>
      <div className="an-activity-meta">
        <span className="an-activity-time">{item.time}</span>
        <span className="an-activity-status" style={{ color: statusCfg.color }}>
          <i className={`fas fa-circle`} style={{ fontSize: 6, verticalAlign: 'middle', marginRight: 4 }} />
          {statusCfg.label}
        </span>
      </div>
    </div>
  );
}

export default function RecentActivities({ activities }) {
  if (!activities?.length) {
    return <div className="an-empty">No recent activity</div>;
  }
  return (
    <div className="an-activity-list">
      {activities.map((item) => (
        <ActivityRow key={item.id} item={item} />
      ))}
    </div>
  );
}
