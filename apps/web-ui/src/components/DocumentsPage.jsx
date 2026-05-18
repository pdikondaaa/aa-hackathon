import React, { useState, useEffect, useCallback, useRef } from 'react';
import { listDocuments } from '../services/api';

// ── Category definitions — Aligned Automation brand colors only ────────────
// Palette: Aligned Blue #1D76BC · Light Blue #27AAE1 · Deep Blue #2A3D90 · Energy Green #4ED44E
const CATEGORIES = [
  {
    id: 'all',
    label: 'All Documents',
    icon: 'fa-layer-group',
    color: '#1D76BC',       // Aligned Blue
    description: 'All ingested documents',
  },
  {
    id: 'hr',
    label: 'HR',
    icon: 'fa-user-tie',
    color: '#27AAE1',       // Light Blue
    description: 'Policies, leave, payroll & employee documents',
  },
  {
    id: 'it',
    label: 'IT',
    icon: 'fa-laptop-code',
    color: '#4ED44E',       // Energy Green
    description: 'Guides, access, security & support docs',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'fa-building',
    color: '#2A3D90',       // Deep Blue
    description: 'Finance, operations, legal & compliance',
  },
  {
    id: 'general',
    label: 'General',
    icon: 'fa-file-alt',
    color: '#1D76BC',       // Aligned Blue (no fifth brand color — reuse primary)
    description: 'Uncategorised documents',
  },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

// ── File-type icon mapping — brand colors only ─────────────────────────────
// #1D76BC Aligned Blue · #27AAE1 Light Blue · #2A3D90 Deep Blue · #4ED44E Energy Green
const DOC_TYPE_ICONS = {
  pdf:   { icon: 'fa-file-pdf',        color: '#1D76BC' },  // Aligned Blue
  docx:  { icon: 'fa-file-word',       color: '#2A3D90' },  // Deep Blue
  doc:   { icon: 'fa-file-word',       color: '#2A3D90' },
  xlsx:  { icon: 'fa-file-excel',      color: '#4ED44E' },  // Energy Green
  xls:   { icon: 'fa-file-excel',      color: '#4ED44E' },
  pptx:  { icon: 'fa-file-powerpoint', color: '#27AAE1' },  // Light Blue
  ppt:   { icon: 'fa-file-powerpoint', color: '#27AAE1' },
  txt:   { icon: 'fa-file-alt',        color: '#1D76BC' },  // Aligned Blue
  html:  { icon: 'fa-file-code',       color: '#27AAE1' },  // Light Blue
  htm:   { icon: 'fa-file-code',       color: '#27AAE1' },
  csv:   { icon: 'fa-file-csv',        color: '#4ED44E' },  // Energy Green
  md:    { icon: 'fa-file-alt',        color: '#2A3D90' },  // Deep Blue
};

function getDocIcon(docType) {
  const ext = (docType || '').toLowerCase().replace('.', '');
  return DOC_TYPE_ICONS[ext] || { icon: 'fa-file', color: '#1D76BC' };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getDocUrl(doc) {
  if (doc.source_url) return doc.source_url;
  if (doc.source_path?.startsWith('http')) return doc.source_path;
  return null;
}

// ── Sub-components ────────────────────────────────────────────────────────

function CategoryBadge({ categoryId }) {
  const cat = CATEGORY_MAP[categoryId] || CATEGORY_MAP.general;
  return (
    <span
      className="doc-category-badge"
      style={{ background: cat.color + '1a', color: cat.color, border: `1px solid ${cat.color}33` }}
    >
      <i className={`fas ${cat.icon}`} />
      {cat.label}
    </span>
  );
}

function DocCard({ doc, onOpen }) {
  const { icon, color } = getDocIcon(doc.document_type);
  const url = getDocUrl(doc);
  const clickable = !!url;

  return (
    <div
      className={`doc-card ${clickable ? 'doc-card--clickable' : ''}`}
      onClick={() => clickable && onOpen(url)}
      title={clickable ? `Open: ${doc.document_name}` : doc.document_name}
    >
      <div className="doc-card-icon-wrap" style={{ '--doc-color': color }}>
        <i className={`fas ${icon}`} />
      </div>

      <div className="doc-card-body">
        <p className="doc-card-name">{doc.document_name}</p>

        <div className="doc-card-meta">
          <CategoryBadge categoryId={doc.category} />
          {doc.document_type && (
            <span className="doc-card-ext">{doc.document_type.toUpperCase()}</span>
          )}
        </div>

        <p className="doc-card-date">
          <i className="far fa-calendar-alt" />
          {formatDate(doc.last_modified || doc.indexed_at)}
        </p>
      </div>

      {clickable && (
        <span className="doc-card-open-hint">
          <i className="fas fa-arrow-up-right-from-square" />
        </span>
      )}
    </div>
  );
}

function CategoryTab({ cat, active, count, onClick }) {
  return (
    <button
      className={`docs-cat-tab ${active ? 'docs-cat-tab--active' : ''}`}
      style={{ '--cat-color': cat.color }}
      onClick={onClick}
      title={cat.description}
    >
      <span className="docs-cat-tab-icon">
        <i className={`fas ${cat.icon}`} />
      </span>
      <span className="docs-cat-tab-label">{cat.label}</span>
      {count != null && (
        <span className="docs-cat-tab-count">{count}</span>
      )}
    </button>
  );
}

function EmptyState({ search, activeCategory }) {
  const cat = CATEGORY_MAP[activeCategory] || CATEGORY_MAP.all;
  return (
    <div className="docs-empty">
      <div className="docs-empty-icon-wrap" style={{ '--cat-color': cat.color }}>
        <i className={`fas ${cat.icon}`} />
      </div>
      <p className="docs-empty-title">
        {search ? `No results for "${search}"` : `No ${cat.label} documents yet`}
      </p>
      <p className="docs-empty-sub">
        {search
          ? 'Try a different keyword or switch category.'
          : 'Documents will appear here once ingestion runs.'}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs, setDocs]               = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [search, setSearch]           = useState('');
  const [activeCategory, setCategory] = useState('all');
  const [page, setPage]               = useState(1);
  const debounceRef                   = useRef(null);
  const LIMIT = 48;

  const fetchDocs = useCallback(async (pg, q, cat) => {
    setLoading(true);
    setError(null);
    try {
      const catParam = cat === 'all' ? undefined : cat;
      const result = await listDocuments(pg, LIMIT, q || undefined, catParam);
      setDocs(result.data || []);
      setTotal(result.total || 0);
    } catch {
      setError('Failed to load documents. Please try again.');
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs(page, search, activeCategory);
  }, [page, activeCategory, fetchDocs]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchDocs(1, val, activeCategory);
    }, 350);
  };

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    fetchDocs(1, '', activeCategory);
  };

  const totalPages = Math.ceil(total / LIMIT);
  const activeCat = CATEGORY_MAP[activeCategory] || CATEGORY_MAP.all;

  return (
    <div className="docs-page">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="docs-header">
        <div className="docs-header-left">
          <h1 className="docs-title">
            <span className="docs-title-icon" style={{ background: activeCat.color + '22', color: activeCat.color }}>
              <i className={`fas ${activeCat.icon}`} />
            </span>
            Documents
          </h1>
          <p className="docs-subtitle">
            {activeCat.description}
            {!loading && <span className="docs-subtitle-count">&nbsp;·&nbsp;{total} document{total !== 1 ? 's' : ''}</span>}
          </p>
        </div>

        <div className="docs-search-wrap">
          <i className="fas fa-search docs-search-icon" />
          <input
            className="docs-search"
            type="text"
            placeholder="Search by name…"
            value={search}
            onChange={handleSearchChange}
          />
          {search && (
            <button className="docs-search-clear" onClick={clearSearch}>
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category tabs ─────────────────────────────────────────────── */}
      <div className="docs-cat-tabs">
        {CATEGORIES.map((cat) => (
          <CategoryTab
            key={cat.id}
            cat={cat}
            active={activeCategory === cat.id}
            count={cat.id === 'all' && !loading ? total : null}
            onClick={() => handleCategoryChange(cat.id)}
          />
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="docs-loading">
          <span className="docs-loading-spinner" style={{ borderTopColor: activeCat.color }} />
          <span>Loading {activeCat.label} documents…</span>
        </div>
      ) : error ? (
        <div className="docs-error">
          <i className="fas fa-exclamation-triangle" />
          <span>{error}</span>
          <button className="docs-retry-btn" onClick={() => fetchDocs(page, search, activeCategory)}>
            <i className="fas fa-redo" /> Retry
          </button>
        </div>
      ) : docs.length === 0 ? (
        <EmptyState search={search} activeCategory={activeCategory} />
      ) : (
        <>
          <div className="docs-grid">
            {docs.map((doc) => (
              <DocCard key={doc.id} doc={doc} onOpen={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="docs-pagination">
              <button
                className="docs-page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <i className="fas fa-chevron-left" /> Prev
              </button>
              <span className="docs-page-info">
                Page {page} of {totalPages}&nbsp;·&nbsp;{total} documents
              </span>
              <button
                className="docs-page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next <i className="fas fa-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
