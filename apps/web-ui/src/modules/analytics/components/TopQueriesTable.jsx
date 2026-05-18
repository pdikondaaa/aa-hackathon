import React, { useState } from 'react';

const PAGE_SIZE = 5;

function SuccessBadge({ rate }) {
  const color = rate >= 95 ? '#4ED44E' : rate >= 85 ? '#f59e0b' : '#f05252';
  return (
    <span className="an-badge" style={{ background: color + '22', color }}>
      {rate}%
    </span>
  );
}

export default function TopQueriesTable({ queries, onSearch }) {
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [sortKey, setSortKey] = useState('hits');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = queries
    .filter((q) => q.query.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
    onSearch?.(e.target.value);
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
            placeholder="Search queries…"
            value={search}
            onChange={handleSearch}
          />
          {search && (
            <button className="an-search-clear" onClick={() => { setSearch(''); setPage(1); }}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <span className="an-table-count">{filtered.length} queries</span>
      </div>

      <div className="an-table-scroll">
        <table className="an-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Query</th>
              <th className="an-th-sort" onClick={() => toggleSort('hits')}>
                Hit Count <SortIcon col="hits" />
              </th>
              <th>Last Used</th>
              <th className="an-th-sort" onClick={() => toggleSort('successRate')}>
                Success Rate <SortIcon col="successRate" />
              </th>
            </tr>
          </thead>
          <tbody>
            {paged.length ? paged.map((row, idx) => (
              <tr key={row.id} className="an-table-row">
                <td className="an-td-num">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                <td className="an-td-query">{row.query}</td>
                <td className="an-td-center">
                  <span className="an-hit-pill">{row.hits.toLocaleString()}</span>
                </td>
                <td className="an-td-center an-td-muted">{row.lastUsed}</td>
                <td className="an-td-center"><SuccessBadge rate={row.successRate} /></td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="an-td-empty">No matching queries found</td></tr>
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
