import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getEmployeeDirectory, getEmployeePhotoBlob } from '../services/api';

function getInitials(name) {
  return (name || '').split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(name) {
  const colors = ['#1D76BC', '#27AAE1', '#2A3D90', '#4ED44E', '#f59e0b', '#f97316', '#8b5cf6', '#06b6d4'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function Spinner({ text = 'Loading…' }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--primary)' }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

function ErrorBox({ error, onRetry }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
      <i className="fas fa-circle-exclamation" style={{ fontSize: 32, color: 'var(--error)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)' }}>Could not load employee directory</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 440, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px' }}>{error}</div>
      {onRetry && (
        <button onClick={onRetry} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <i className="fas fa-rotate-right" style={{ marginRight: 6 }} />Retry
        </button>
      )}
    </div>
  );
}

// Fetches the Microsoft 365 profile photo only once the avatar scrolls into
// view, and only when a photo actually exists — falls back to initials otherwise.
function EmployeeAvatar({ name, email }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const ref = useRef(null);
  const color = avatarColor(name);

  useEffect(() => {
    if (!email || !ref.current) return;
    const el = ref.current;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();
        getEmployeePhotoBlob(email)
          .then(blob => setPhotoUrl(URL.createObjectURL(blob)))
          .catch(() => {})
          .finally(() => setAttempted(true));
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [email]);

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  return (
    <div ref={ref} style={{
      width: 44, height: 44, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#fff',
      overflow: 'hidden', opacity: !attempted ? 0.85 : 1,
    }}>
      {photoUrl ? (
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : getInitials(name)}
    </div>
  );
}

function EmployeeCard({ emp }) {
  const teamsUrl = emp.email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(emp.email)}` : null;
  const orgChartUrl = emp.zoho_record_id
    ? `https://people.zoho.com/alignedautomationservices/zp#home/organization/employeetree-id:${emp.zoho_record_id}`
    : null;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <EmployeeAvatar name={emp.name} email={emp.email} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{emp.designation || '—'}</div>
        </div>
      </div>

      {emp.department && (
        <div>
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 12,
            fontSize: 10.5, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
            border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.03em',
          }}>{emp.department}</span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border-light)' }}>
        {orgChartUrl ? (
          <a
            href={orgChartUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`View ${emp.name} in Zoho People's org chart`}
            style={{
              color: 'var(--primary)', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none',
            }}
          >
            <i className="fas fa-sitemap" style={{ fontSize: 11 }} />
            ORG CHART
          </a>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            <i className="fas fa-sitemap" style={{ fontSize: 11 }} />
            ORG CHART
          </span>
        )}

        {emp.email && (
          <a
            href={teamsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Chat with ${emp.name} on Teams`}
            style={{ color: 'var(--text-muted)', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            @{emp.teams_handle}
            <i className="fab fa-microsoft" style={{ color: '#5b5fc7', fontSize: 13 }} />
          </a>
        )}
      </div>
    </div>
  );
}

export default function EmployeeDirectoryPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getEmployeeDirectory()
      .then(setData)
      .catch(e => setError(e?.message || 'Failed to load employee directory'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const all = data?.employees || [];
    const q = search.trim().toLowerCase();
    return all.filter(e => {
      if (department && e.department !== department) return false;
      if (designation && e.designation !== designation) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, department, designation]);

  const selectStyle = {
    padding: '9px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-card)', color: 'var(--text)', fontSize: 13, cursor: 'pointer', outline: 'none',
  };

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
      <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(29,118,188,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fas fa-address-book" style={{ color: 'var(--primary)', fontSize: 14 }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Employee Directory</h1>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px',
          }}>
            <i className="fas fa-search" style={{ color: 'var(--text-muted)', fontSize: 13 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name…"
              style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
            />
          </div>
          <select value={department} onChange={e => setDepartment(e.target.value)} style={selectStyle}>
            <option value="">All Departments</option>
            {(data?.filter_options?.departments || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={designation} onChange={e => setDesignation(e.target.value)} style={selectStyle}>
            <option value="">All Designations</option>
            {(data?.filter_options?.designations || []).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px' }}>
        {loading ? (
          <Spinner text="Loading employee directory…" />
        ) : error ? (
          <ErrorBox error={error} onRetry={load} />
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              <strong style={{ color: 'var(--text)' }}>{filtered.length}</strong> people
            </div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                <i className="fas fa-user-slash" style={{ fontSize: 26, marginBottom: 8, display: 'block' }} />
                No employees match your filters.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {filtered.map(emp => <EmployeeCard key={emp.employee_id || emp.email} emp={emp} />)}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
