import React from 'react';

const STATUS_MAP = {
  completed:   { label: 'Completed',   cls: 'og-badge-completed'   },
  'in-progress': { label: 'In Progress', cls: 'og-badge-in-progress' },
  pending:     { label: 'Pending',     cls: 'og-badge-pending'     },
  'not-started': { label: 'Not Started', cls: 'og-badge-not-started' },
  uploaded:    { label: 'Uploaded',    cls: 'og-badge-uploaded'    },
  required:    { label: 'Required',    cls: 'og-badge-required'    },
  upcoming:    { label: 'Upcoming',    cls: 'og-badge-pending'     },
  done:        { label: 'Done',        cls: 'og-badge-completed'   },
};

const StatusBadge = ({ status, className = '' }) => {
  const config = STATUS_MAP[status] || { label: status, cls: 'og-badge-pending' };
  return (
    <span className={`og-badge ${config.cls} ${className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
