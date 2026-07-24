import React, { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../services/analyticsApi';

const PAGE_SIZE = 15;

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

export default function RecentActivities({ refreshKey }) {
  const [page,     setPage]     = useState(1);
  const [items,    setItems]    = useState(null);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const res = await analyticsApi.getActivities(targetPage, PAGE_SIZE);
      setItems(res.data || []);
      setTotal(res.total || 0);
      setPage(res.page || targetPage);
    } catch (err) {
      setError(err.message || 'Failed to load recent activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading && items === null) {
    return <div className="an-empty"><i className="fas fa-spinner fa-spin" /> Loading activity…</div>;
  }
  if (error) {
    return <div className="an-empty">{error}</div>;
  }
  if (!items?.length) {
    return <div className="an-empty">No recent activity</div>;
  }

  return (
    <div>
      <div className="an-activity-list" style={{ opacity: loading ? 0.5 : 1 }}>
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="an-pagination">
          <button
            className="an-page-btn"
            onClick={() => load(page - 1)}
            disabled={page === 1 || loading}
          >
            <i className="fas fa-chevron-left" />
          </button>
          <span className="an-page-info">Page {page} of {totalPages}</span>
          <button
            className="an-page-btn"
            onClick={() => load(page + 1)}
            disabled={page === totalPages || loading}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
