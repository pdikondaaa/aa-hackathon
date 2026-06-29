import React, { useState, useEffect, useCallback } from 'react';
import {
  adminListForms, adminDeleteForm, adminArchiveForm, adminPublishForm,
} from '../services/formBuilderApi';
import SubmissionsAdmin  from './SubmissionsAdmin';

const STATUS_COLORS = {
  draft:     { bg: 'rgba(245,158,11,0.13)', text: '#f59e0b',          icon: 'fa-pen' },
  published: { bg: 'rgba(78,212,78,0.13)',  text: 'var(--success)',   icon: 'fa-globe' },
  archived:  { bg: 'rgba(94,122,154,0.13)', text: 'var(--text-muted)', icon: 'fa-archive' },
};

const CATEGORY_COLORS = [
  '#1D76BC', '#27AAE1', '#2A3D90', '#0F766E', '#7C3AED', '#B45309',
];

function categoryColor(cat) {
  if (!cat) return '#1D76BC';
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = cat.charCodeAt(i) + ((h << 5) - h);
  return CATEGORY_COLORS[Math.abs(h) % CATEGORY_COLORS.length];
}

/* ─────────────────── Status badge ─────────────────── */
function StatusBadge({ status }) {
  const col = STATUS_COLORS[status] || { bg: 'var(--bg-elevated)', text: 'var(--text-muted)', icon: 'fa-circle' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: col.bg, color: col.text,
      padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      <i className={`fas ${col.icon}`} style={{ fontSize: 9 }} />
      {status}
    </span>
  );
}

/* ─────────────────── Form card ─────────────────── */
function FormCard({ form, onEdit, onPublish, onArchive, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const accent = categoryColor(form.category);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${hovered ? accent : 'var(--border)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.18s, box-shadow 0.18s',
        boxShadow: hovered ? `0 4px 20px rgba(0,0,0,0.18)` : 'none',
        cursor: 'default',
      }}
    >
      {/* Colored top strip */}
      <div style={{ height: 4, background: accent, flexShrink: 0 }} />

      {/* Card body */}
      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: `${accent}22`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent, fontSize: 15,
          }}>
            <i className={`fas ${form.icon || 'fa-file-alt'}`} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, marginBottom: 2 }}>
              {form.name}
            </div>
            {form.alias && (
              <code style={{ fontSize: 10, color: accent, background: `${accent}18`, padding: '1px 6px', borderRadius: 4 }}>
                /{form.alias}
              </code>
            )}
          </div>
          <StatusBadge status={form.status} />
        </div>

        {/* Description */}
        {form.description ? (
          <div style={{
            fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {form.description}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</div>
        )}

        {/* Meta pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <i className="fas fa-code-branch" style={{ fontSize: 9 }} /> v{form.version}
          </span>
          {form.category && (
            <span style={{
              fontSize: 11, color: accent,
              background: `${accent}18`, padding: '1px 7px', borderRadius: 10,
            }}>
              {form.category}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            {new Date(form.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Action strip */}
      <div style={{
        display: 'flex', gap: 0,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
      }}>
        <ActionBtn icon="fa-edit" label="Edit" onClick={() => onEdit(form)} primary />
        {form.status === 'draft' && (
          <ActionBtn icon="fa-globe" label="Publish" onClick={() => onPublish(form.id)}
            style={{ color: 'var(--success)' }} />
        )}
        {form.status === 'published' && (
          <ActionBtn icon="fa-archive" label="Archive" onClick={() => onArchive(form.id)} />
        )}
        <div style={{ marginLeft: 'auto' }}>
          <ActionBtn
            icon="fa-trash" label=""
            onClick={() => window.confirm(`Delete "${form.name}"?`) && onDelete(form.id)}
            style={{ color: 'var(--error)' }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, primary, style: extra = {} }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? 'var(--bg-card)' : 'transparent',
        border: 'none',
        padding: label ? '7px 12px' : '7px 11px',
        fontSize: 12, fontWeight: 600,
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'background 0.13s',
        ...extra,
      }}
    >
      <i className={`fas ${icon}`} />
      {label}
    </button>
  );
}

/* ─────────────────── Stat card ─────────────────── */
function StatCard({ icon, value, label, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      flex: '1 1 140px', minWidth: 0,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        background: `${color}22`, color, fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`fas ${icon}`} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─────────────────── Tab navigation ─────────────────── */
const TABS = [
  { id: 'forms',     label: 'Forms',          icon: 'fa-wpforms' },
  { id: 'submitted', label: 'Submitted Data', icon: 'fa-inbox' },
];

export default function FormBuilderAdmin({ onCreateForm, onEditForm, user }) {
  const [activeTab, setActiveTab] = useState('forms');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        paddingLeft: 28, flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                padding: '13px 18px',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'color 0.15s, border-color 0.15s',
                marginBottom: -1,
              }}
            >
              <i className={`fas ${tab.icon}`} style={{ fontSize: 12 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'forms'     && <FormsListPanel onCreateForm={onCreateForm} onEditForm={onEditForm} />}
        {activeTab === 'submitted' && <SubmissionsAdmin currentUserEmail={user?.email} />}
      </div>
    </div>
  );
}

/* ─────────────────── Main page (forms list) ─────────────────── */
function FormsListPanel({ onCreateForm, onEditForm }) {
  const [forms, setForms]     = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);
  const limit = 24;

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (status) params.status = status;
      const data = await adminListForms(params);
      setForms(data.items || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { loadForms(); }, [loadForms]);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(t);
  }, [search]);

  const handlePublish = async (id) => {
    try { await adminPublishForm(id); loadForms(); }
    catch (e) { alert('Publish failed: ' + e.message); }
  };
  const handleArchive = async (id) => {
    try { await adminArchiveForm(id); loadForms(); }
    catch (e) { alert('Archive failed: ' + e.message); }
  };
  const handleDelete = async (id) => {
    try { await adminDeleteForm(id); loadForms(); }
    catch (e) { alert('Delete failed: ' + e.message); }
  };

  const counts = {
    draft:     forms.filter(f => f.status === 'draft').length,
    published: forms.filter(f => f.status === 'published').length,
    archived:  forms.filter(f => f.status === 'archived').length,
  };
  const totalPages = Math.ceil(total / limit);

  return (
    /* Outer: fills flex slot and scrolls */
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* ── Page header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, background: 'rgba(29,118,188,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)', fontSize: 17,
              }}>
                <i className="fas fa-wpforms" />
              </div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                  Form Builder
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, marginTop: 2 }}>
                  Build forms, add automation, and publish to users
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onCreateForm}
            style={{
              background: 'var(--primary)', color: '#fff', border: 'none',
              borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 2px 8px rgba(29,118,188,0.35)',
            }}
          >
            <i className="fas fa-plus" /> New Form
          </button>
        </div>

        {/* ── Stats row ── */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard icon="fa-layer-group"  value={total}            label="Total Forms"      color="#1D76BC" />
          <StatCard icon="fa-pen"          value={counts.draft}     label="Drafts"           color="#f59e0b" />
          <StatCard icon="fa-globe"        value={counts.published} label="Published"        color="var(--success)" />
          <StatCard icon="fa-diagram-project" value={0}             label="Automations"      color="#0F766E" />
        </div>

        {/* ── Search & filters ── */}
        <div style={{
          display: 'flex', gap: 10, marginBottom: 20,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 14px', alignItems: 'center',
        }}>
          <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: 13 }} />
          <input
            style={{
              flex: 1, background: 'transparent', border: 'none',
              outline: 'none', fontSize: 13, color: 'var(--text)',
            }}
            placeholder="Search by name, alias, description, category…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            >
              <i className="fas fa-times" />
            </button>
          )}
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
          <select
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
            }}
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* ── Grid / states ── */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-muted)', gap: 10 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 20 }} />
            <span style={{ fontSize: 14 }}>Loading forms…</span>
          </div>
        ) : forms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--text-muted)' }}>
            <i className="fas fa-file-circle-plus" style={{ fontSize: 44, marginBottom: 16, color: 'var(--border)' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {search || status ? 'No forms match your filters' : 'No forms yet'}
            </div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              {search || status ? 'Try a different search or status filter.' : 'Create your first form to get started.'}
            </div>
            {!search && !status && (
              <button
                onClick={onCreateForm}
                style={{
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <i className="fas fa-plus" style={{ marginRight: 7 }} />Create New Form
              </button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 16,
          }}>
            {forms.map(form => (
              <FormCard
                key={form.id}
                form={form}
                onEdit={onEditForm}
                onPublish={handlePublish}
                onArchive={handleArchive}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 32 }}>
            <PagBtn disabled={page === 1} onClick={() => setPage(1)}>
              <i className="fas fa-angles-left" />
            </PagBtn>
            <PagBtn disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <i className="fas fa-chevron-left" />
            </PagBtn>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '5px 12px', background: 'var(--bg-secondary)', borderRadius: 7, border: '1px solid var(--border)' }}>
              {page} / {totalPages}
            </span>
            <PagBtn disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <i className="fas fa-chevron-right" />
            </PagBtn>
            <PagBtn disabled={page === totalPages} onClick={() => setPage(totalPages)}>
              <i className="fas fa-angles-right" />
            </PagBtn>
          </div>
        )}
      </div>
    </div>
  );
}

function PagBtn({ children, disabled, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        borderRadius: 7, padding: '6px 11px', fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-muted)' : 'var(--text)', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}
