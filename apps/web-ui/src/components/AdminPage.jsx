import React, { useState, useEffect } from 'react';
import { ROLES, getPermissionsForRole } from '../config/userConfig';
import { apiConfig } from '../config/apiConfig';
import { chatConfig as appConfig } from '../config/chatConfig';
import { adminListUsers, adminSetUserRole, adminRemoveUser } from '../services/api';

const ROLE_COLORS = {
  admin: '#f05252',
  hr:    '#1D76BC',
  it:    '#27AAE1',
  org:   '#2A3D90',
  user:  '#5e7a9a',
};

const ROLE_LABELS = {
  admin: 'Admin',
  hr:    'HR',
  it:    'IT',
  org:   'Org',
  user:  'User',
};

export default function AdminPage({ user }) {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [editingEmail, setEditingEmail] = useState(null);
  const [pendingRole, setPendingRole]   = useState('');
  const [saveMsg, setSaveMsg]           = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [newRole, setNewRole]           = useState(ROLES.USER);
  const [addError, setAddError]         = useState('');

  const loadUsers = () => {
    setLoading(true);
    setLoadError('');
    return adminListUsers()
      .then(res => setUsers(res.users || []))
      .catch(err => setLoadError(err.message || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadUsers(); }, []);

  const flash = (msg) => {
    setSaveMsg(msg);
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const saveRole = (email) => {
    const current = users.find(u => u.email === email)?.role;
    if (pendingRole && pendingRole !== current) {
      adminSetUserRole(email, pendingRole)
        .then(() => { flash(`Role updated for ${email}`); return loadUsers(); })
        .catch(err => flash(err.message || `Failed to update ${email}`));
    }
    setEditingEmail(null);
    setPendingRole('');
  };

  const removeUser = (email) => {
    adminRemoveUser(email)
      .then(() => { flash(`Removed ${email}`); return loadUsers(); })
      .catch(err => flash(err.message || `Failed to remove ${email}`));
  };

  const addUser = (e) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    setAddError('');
    adminSetUserRole(email, newRole)
      .then(() => {
        flash(`${email} added as ${ROLE_LABELS[newRole]}`);
        setNewEmail('');
        setNewRole(ROLES.USER);
        return loadUsers();
      })
      .catch(err => setAddError(err.message || `Failed to add ${email}`));
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-sliders" style={{ color: 'var(--primary)' }} />
          Settings
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 }}>
          Manage users, roles and application configuration
        </p>
      </div>

      <div>
          {saveMsg && (
            <div style={{ background: 'rgba(78,212,78,0.12)', border: '1px solid #4ED44E', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#4ED44E', fontSize: 13 }}>
              <i className="fas fa-check-circle" style={{ marginRight: 8 }} />{saveMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <SectionTitle style={{ margin: 0 }}>User Management</SectionTitle>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{users.length} users</span>
          </div>

          <form onSubmit={addUser} style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'flex-start' }}>
            <input
              type="email"
              required
              placeholder="email@alignedautomation.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              style={{ flex: 1, maxWidth: 320, background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
            />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              style={{ background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 13 }}
            >
              {Object.values(ROLES).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <button type="submit" style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />Add User
            </button>
          </form>
          {addError && (
            <div style={{ color: 'var(--error, #f05252)', fontSize: 12, marginBottom: 16 }}>{addError}</div>
          )}

          {loadError && (
            <div style={{ background: 'rgba(240,82,82,0.1)', border: '1px solid #f05252', borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: '#f05252', fontSize: 13 }}>
              {loadError}
            </div>
          )}

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Email', 'Role', 'Agents', 'Admin Access', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Loading…</td></tr>
                ) : users.map(({ email, role }) => {
                  const permissions = getPermissionsForRole(role);
                  const isCurrentUser = email === user?.email;
                  const isEditing = editingEmail === email;
                  return (
                    <tr key={email} style={{ borderBottom: '1px solid var(--border-light)', background: isCurrentUser ? 'rgba(29,118,188,0.04)' : 'transparent' }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)' }}>
                        {isCurrentUser && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(29,118,188,0.2)', color: 'var(--primary)', marginRight: 6, fontWeight: 700 }}>YOU</span>
                        )}
                        {email}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isEditing ? (
                          <select
                            value={pendingRole}
                            onChange={e => setPendingRole(e.target.value)}
                            autoFocus
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--primary)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                          >
                            {Object.values(ROLES).map(r => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        ) : (
                          <Badge color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {permissions.agents.length ? permissions.agents.join(', ') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {permissions.canAccessAdminPanel
                          ? <i className="fas fa-check-circle" style={{ color: '#4ED44E', fontSize: 14 }} />
                          : <i className="fas fa-times-circle" style={{ color: 'var(--text-muted)', fontSize: 14 }} />}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => saveRole(email)} style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                              Save
                            </button>
                            <button onClick={() => { setEditingEmail(null); setPendingRole(''); }} style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => { setEditingEmail(email); setPendingRole(role); }}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? 'Cannot edit your own role' : 'Edit role'}
                              style={{ background: 'none', color: isCurrentUser ? 'var(--text-muted)' : 'var(--primary)', border: `1px solid ${isCurrentUser ? 'var(--border)' : 'var(--primary)'}`, borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: isCurrentUser ? 'default' : 'pointer', opacity: isCurrentUser ? 0.5 : 1 }}
                            >
                              <i className="fas fa-pen" style={{ marginRight: 5 }} />Edit
                            </button>
                            <button
                              onClick={() => removeUser(email)}
                              disabled={isCurrentUser}
                              title={isCurrentUser ? 'Cannot remove yourself' : 'Remove'}
                              style={{ background: 'none', color: isCurrentUser ? 'var(--text-muted)' : '#f05252', border: `1px solid ${isCurrentUser ? 'var(--border)' : '#f05252'}`, borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: isCurrentUser ? 'default' : 'pointer', opacity: isCurrentUser ? 0.5 : 1 }}
                            >
                              <i className="fas fa-trash" style={{ marginRight: 5 }} />Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <SectionTitle>Application Settings</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            <SettingsCard title="App Meta">
              {[
                { key: 'Name',     val: appConfig.app.name },
                { key: 'Subtitle', val: appConfig.app.subtitle },
                { key: 'Version',  val: appConfig.app.version || '—' },
              ].map(({ key, val }) => <ConfigRow key={key} label={key} value={val} />)}
            </SettingsCard>

            <SettingsCard title="API Settings">
              {[
                { key: 'Environment', val: apiConfig.environment },
                { key: 'Base URL',    val: apiConfig.baseUrl },
                { key: 'Timeout',     val: `${apiConfig.timeout / 1000}s` },
                { key: 'Retries',     val: apiConfig.retryAttempts },
                { key: 'Debug Mode',  val: apiConfig.debug ? 'Enabled' : 'Disabled' },
              ].map(({ key, val }) => <ConfigRow key={key} label={key} value={val} mono />)}
            </SettingsCard>
          </div>
      </div>
    </div>
  );
}

// ── Small reusable sub-components ────────────────────────────────────────────

function SectionTitle({ children, style }) {
  return (
    <h2 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 600, margin: '0 0 14px', ...style }}>
      {children}
    </h2>
  );
}

function Badge({ color, children }) {
  return (
    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: `${color}22`, color, fontWeight: 600, textTransform: 'capitalize', display: 'inline-block' }}>
      {children}
    </span>
  );
}

function ConfigRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: 13, gap: 12 }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text)', fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SettingsCard({ title, children }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
      <h3 style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{title}</h3>
      {children}
    </div>
  );
}
