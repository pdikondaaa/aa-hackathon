import React, { useState } from 'react';

const PAGE_SIZE = 10;

function relativeTime(iso) {
  if (!iso) return 'Never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function StatusBadge({ active }) {
  const color = active ? '#4ED44E' : '#a8bdd4';
  return (
    <span className="an-badge" style={{ background: color + '22', color }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function UsersTable({ users }) {
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [sortKey, setSortKey] = useState('lastActiveAt');
  const [sortAsc, setSortAsc] = useState(false);

  if (!users) return <div className="an-empty">Loading users…</div>;

  const q = search.toLowerCase();
  const filtered = users
    .filter((u) => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
    .sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      let cmp;
      if (av == null && bv == null) cmp = 0;
      else if (av == null) cmp = -1;
      else if (bv == null) cmp = 1;
      else if (typeof av === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortIcon = ({ col }) => (
    <i className={`fas fa-sort${sortKey === col ? (sortAsc ? '-up' : '-down') : ''} an-sort-icon`} />
  );

  return (
    <div className="an-table-wrap">
      <div className="an-table-toolbar">
        <div className="an-search-wrap">
          <i className="fas fa-magnifying-glass an-search-icon" />
          <input
            className="an-search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className="an-search-clear" onClick={() => { setSearch(''); setPage(1); }}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <span className="an-table-count">{filtered.length} users</span>
      </div>

      <div className="an-table-scroll">
        <table className="an-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Email</th>
              <th className="an-th-sort" onClick={() => toggleSort('totalConversations')}>
                Conversations <SortIcon col="totalConversations" />
              </th>
              <th className="an-th-sort" onClick={() => toggleSort('totalQueries')}>
                Queries <SortIcon col="totalQueries" />
              </th>
              <th className="an-th-sort" onClick={() => toggleSort('lastActiveAt')}>
                Last Active <SortIcon col="lastActiveAt" />
              </th>
              <th>Joined</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.length ? paged.map((u, idx) => (
              <tr key={u.id} className="an-table-row">
                <td className="an-td-num">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                <td className="an-td-query">{u.name}</td>
                <td className="an-td-muted">{u.email}</td>
                <td className="an-td-center">
                  <span className="an-hit-pill">{u.totalConversations.toLocaleString()}</span>
                </td>
                <td className="an-td-center">
                  <span className="an-hit-pill">{u.totalQueries.toLocaleString()}</span>
                </td>
                <td className="an-td-center an-td-muted">{relativeTime(u.lastActiveAt)}</td>
                <td className="an-td-center an-td-muted">{u.joinedAt}</td>
                <td className="an-td-center"><StatusBadge active={u.isActive} /></td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="an-td-empty">No matching users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="an-pagination">
          <button
            className="an-page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <i className="fas fa-chevron-left" />
          </button>
          <span className="an-page-info">Page {page} of {totalPages}</span>
          <button
            className="an-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      )}
    </div>
  );
}
