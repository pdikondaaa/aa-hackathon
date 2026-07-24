import React, { useState, useEffect, useCallback } from 'react';
import {
  adminListAnnouncements,
  adminCreateAnnouncement,
  adminUpdateAnnouncement,
  adminDeleteAnnouncement,
  adminListEvents,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
} from '../services/api';

// ── Config ─────────────────────────────────────────────────────────────────
const PRIORITY_COLORS = {
  critical: '#f87171', high: '#fb923c', medium: '#60a5fa', low: '#4ade80',
};
const STATUS_COLORS = {
  draft: '#6b7280', published: '#4ade80', scheduled: '#fb923c', archived: '#9ca3af',
  upcoming: '#60a5fa', live: '#4ade80', completed: '#6b7280', cancelled: '#f87171',
};

function Badge({ value, map = STATUS_COLORS }) {
  const color = map[value] || '#6b7280';
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}44`,
      color, borderRadius: 4, padding: '2px 8px',
      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
    }}>{value}</span>
  );
}

// ── Empty Announcement form ────────────────────────────────────────────────
const EMPTY_ANN = {
  title: '', message: '', rich_content: '', banner_image_url: '',
  priority: 'medium', display_mode: 'banner', status: 'published',
  cta_label: '', cta_url: '', cta_type: 'link',
  auto_hide_seconds: '', allow_dismiss: true,
  scheduled_start: '', scheduled_end: '',
};

// ── Empty Event form ───────────────────────────────────────────────────────
const EMPTY_EVT = {
  title: '', description: '', cover_image_url: '',
  event_type: 'general', status: 'upcoming', publish_status: 'published',
  starts_at: '', ends_at: '', timezone: 'Asia/Kolkata',
  location: '', virtual_link: '', is_virtual: false,
  rsvp_enabled: false, max_attendees: '',
};

export default function CommunicationsAdmin({ user }) {
  const [tab, setTab] = useState('announcements');

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: 'var(--text)', fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-bullhorn" style={{ color: 'var(--primary)' }} />
          Communications
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: 14 }}>
          Manage org-wide announcements and events
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display:      'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 28,
        gap:          0,
      }}>
        {[
          { id: 'announcements', label: 'Announcements', icon: 'fa-megaphone' },
          { id: 'events',        label: 'Events',        icon: 'fa-calendar-days' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background:   'none',
              border:       'none',
              borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
              color:        tab === t.id ? 'var(--primary)' : 'var(--text-muted)',
              padding:      '8px 20px 12px',
              fontSize:     14,
              fontWeight:   tab === t.id ? 600 : 400,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              gap:          7,
            }}
          >
            <i className={`fas ${t.icon}`} style={{ fontSize: 13 }} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'announcements' && <AnnouncementsPanel />}
      {tab === 'events'        && <EventsPanel />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ANNOUNCEMENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function AnnouncementsPanel() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);  // item being edited
  const [form,     setForm]     = useState(EMPTY_ANN);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast,    setToast]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListAnnouncements(1, 100);
      setItems(res.data || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_ANN);
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '', message: item.message || '',
      rich_content: item.rich_content || '', banner_image_url: item.banner_image_url || '',
      priority: item.priority || 'medium', display_mode: item.display_mode || 'banner',
      status: item.status || 'draft', cta_label: item.cta_label || '',
      cta_url: item.cta_url || '', cta_type: item.cta_type || 'link',
      auto_hide_seconds: item.auto_hide_seconds || '',
      allow_dismiss: item.allow_dismiss !== false,
      scheduled_start: item.scheduled_start ? item.scheduled_start.slice(0, 16) : '',
      scheduled_end:   item.scheduled_end   ? item.scheduled_end.slice(0, 16)   : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    setSaving(true);
    try {
      // Convert local datetime-local strings to UTC ISO so the backend
      // (which compares against datetime.now(timezone.utc)) sees the correct time.
      const toUTC = (localStr) => localStr ? new Date(localStr).toISOString() : null;
      const payload = {
        ...form,
        auto_hide_seconds: form.auto_hide_seconds ? Number(form.auto_hide_seconds) : null,
        scheduled_start:   toUTC(form.scheduled_start),
        scheduled_end:     toUTC(form.scheduled_end),
        rich_content:      form.rich_content    || null,
        banner_image_url:  form.banner_image_url || null,
        cta_label:         form.cta_label       || null,
        cta_url:           form.cta_url         || null,
      };
      if (editing) {
        await adminUpdateAnnouncement(editing.id, payload);
        showToast('Announcement updated');
      } else {
        await adminCreateAnnouncement(payload);
        showToast('Announcement created');
      }
      setShowForm(false);
      load();
    } catch (_) {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    setDeleting(id);
    try {
      await adminDeleteAnnouncement(id);
      showToast('Announcement deleted');
      load();
    } catch (_) {} finally { setDeleting(null); }
  };

  const quickPublish = async (item) => {
    try {
      await adminUpdateAnnouncement(item.id, { status: item.status === 'published' ? 'archived' : 'published' });
      showToast(item.status === 'published' ? 'Archived' : 'Published');
      load();
    } catch (_) {}
  };

  return (
    <>
      {toast && (
        <div style={{
          background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          color: '#4ade80', fontSize: 13,
        }}>
          <i className="fas fa-check-circle" style={{ marginRight: 8 }} />{toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{items.length} announcement{items.length !== 1 ? 's' : ''}</span>
        <button onClick={openCreate} style={primaryBtn}>
          <i className="fas fa-plus" style={{ marginRight: 6 }} />Create Announcement
        </button>
      </div>

      {/* Inline create/edit form */}
      {showForm && (
        <AnnForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
          isEdit={!!editing}
        />
      )}

      {loading ? (
        <LoadingRows />
      ) : items.length === 0 ? (
        <EmptyPlaceholder icon="fa-megaphone" label="No announcements yet" />
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Priority', 'Mode', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {item.title}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge value={item.priority} map={PRIORITY_COLORS} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.display_mode}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge value={item.status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionBtn
                        label={item.status === 'published' ? 'Archive' : 'Publish'}
                        icon={item.status === 'published' ? 'fa-box-archive' : 'fa-paper-plane'}
                        onClick={() => quickPublish(item)}
                        color={item.status === 'published' ? '#6b7280' : '#4ade80'}
                      />
                      <ActionBtn label="Edit"   icon="fa-pen"   onClick={() => openEdit(item)}           color="var(--primary)" />
                      <ActionBtn label="Delete" icon="fa-trash" onClick={() => handleDelete(item.id)}     color="#f87171"
                        disabled={deleting === item.id} loading={deleting === item.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AnnForm({ form, setForm, onSave, onCancel, saving, isEdit }) {
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--primary)33',
      borderRadius: 14, padding: '24px 28px', marginBottom: 24,
      boxShadow: '0 4px 24px rgba(29,118,188,0.08)',
    }}>
      <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>
        <i className="fas fa-megaphone" style={{ color: 'var(--primary)', marginRight: 8 }} />
        {isEdit ? 'Edit Announcement' : 'New Announcement'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Title *</Label>
          <Input value={form.title} onChange={f('title')} placeholder="Announcement title" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Message *</Label>
          <Textarea value={form.message} onChange={f('message')} placeholder="Announcement body text" rows={3} />
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={form.priority} onChange={f('priority')} options={['low','medium','high','critical']} />
        </div>
        <div>
          <Label>Display Mode</Label>
          <Select value={form.display_mode} onChange={f('display_mode')} options={['banner','overlay','carousel','inline']} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onChange={f('status')} options={['draft','published','scheduled','archived']} />
        </div>
        <div>
          <Label>CTA Type</Label>
          <Select value={form.cta_type} onChange={f('cta_type')} options={['link','acknowledge','dismiss']} />
        </div>
        <div>
          <Label>CTA Label</Label>
          <Input value={form.cta_label} onChange={f('cta_label')} placeholder="e.g. View Details" />
        </div>
        <div>
          <Label>CTA URL</Label>
          <Input value={form.cta_url} onChange={f('cta_url')} placeholder="https://…" />
        </div>
        <div>
          <Label>Auto-hide (seconds)</Label>
          <Input type="number" value={form.auto_hide_seconds} onChange={f('auto_hide_seconds')} placeholder="0 = no auto-hide" />
        </div>
        <div>
          <Label>Banner Image URL</Label>
          <Input value={form.banner_image_url} onChange={f('banner_image_url')} placeholder="https://…" />
        </div>
        <div>
          <Label>Scheduled Start</Label>
          <Input type="datetime-local" value={form.scheduled_start} onChange={f('scheduled_start')} />
        </div>
        <div>
          <Label>Scheduled End</Label>
          <Input type="datetime-local" value={form.scheduled_end} onChange={f('scheduled_end')} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="allow_dismiss" checked={form.allow_dismiss} onChange={f('allow_dismiss')} />
          <label htmlFor="allow_dismiss" style={{ color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            Allow users to dismiss
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={primaryBtn}>
          {saving ? <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> : <i className="fas fa-check" style={{ marginRight: 6 }} />}
          {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EVENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function EventsPanel() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [form,     setForm]     = useState(EMPTY_EVT);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [toast,    setToast]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminListEvents(1, 100);
      setItems(res.data || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  const openCreate = () => { setEditing(null); setForm(EMPTY_EVT); setShowForm(true); };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title:          item.title || '',
      description:    item.description || '',
      cover_image_url: item.cover_image_url || '',
      event_type:     item.event_type || 'general',
      status:         item.status || 'upcoming',
      publish_status: item.publish_status || 'draft',
      starts_at:      item.starts_at ? item.starts_at.slice(0, 16) : '',
      ends_at:        item.ends_at   ? item.ends_at.slice(0, 16)   : '',
      timezone:       item.timezone  || 'Asia/Kolkata',
      location:       item.location  || '',
      virtual_link:   item.virtual_link || '',
      is_virtual:     item.is_virtual || false,
      rsvp_enabled:   item.rsvp_enabled || false,
      max_attendees:  item.max_attendees || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.starts_at) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        max_attendees:   form.max_attendees ? Number(form.max_attendees) : null,
        ends_at:         form.ends_at       || null,
        description:     form.description   || null,
        cover_image_url: form.cover_image_url || null,
        location:        form.location      || null,
        virtual_link:    form.virtual_link  || null,
      };
      if (editing) {
        await adminUpdateEvent(editing.id, payload);
        showToast('Event updated');
      } else {
        await adminCreateEvent(payload);
        showToast('Event created');
      }
      setShowForm(false);
      load();
    } catch (_) {} finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    setDeleting(id);
    try {
      await adminDeleteEvent(id);
      showToast('Event deleted');
      load();
    } catch (_) {} finally { setDeleting(null); }
  };

  const quickPublish = async (item) => {
    try {
      await adminUpdateEvent(item.id, {
        publish_status: item.publish_status === 'published' ? 'archived' : 'published',
      });
      showToast(item.publish_status === 'published' ? 'Archived' : 'Published');
      load();
    } catch (_) {}
  };

  return (
    <>
      {toast && (
        <div style={{
          background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          color: '#4ade80', fontSize: 13,
        }}>
          <i className="fas fa-check-circle" style={{ marginRight: 8 }} />{toast}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{items.length} event{items.length !== 1 ? 's' : ''}</span>
        <button onClick={openCreate} style={primaryBtn}>
          <i className="fas fa-plus" style={{ marginRight: 6 }} />Create Event
        </button>
      </div>

      {showForm && (
        <EventForm
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
          isEdit={!!editing}
        />
      )}

      {loading ? (
        <LoadingRows />
      ) : items.length === 0 ? (
        <EmptyPlaceholder icon="fa-calendar-days" label="No events yet" />
      ) : (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Type', 'Starts', 'Status', 'Published', 'RSVP', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                    {item.title}
                    {item.is_virtual && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#60a5fa' }}>
                        <i className="fas fa-video" /> Virtual
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.event_type}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.starts_at ? new Date(item.starts_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge value={item.status} />
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Badge value={item.publish_status} />
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {item.rsvp_enabled ? `${item.rsvp_count || 0} attending` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionBtn
                        label={item.publish_status === 'published' ? 'Archive' : 'Publish'}
                        icon={item.publish_status === 'published' ? 'fa-box-archive' : 'fa-paper-plane'}
                        onClick={() => quickPublish(item)}
                        color={item.publish_status === 'published' ? '#6b7280' : '#4ade80'}
                      />
                      <ActionBtn label="Edit"   icon="fa-pen"   onClick={() => openEdit(item)}       color="var(--primary)" />
                      <ActionBtn label="Delete" icon="fa-trash" onClick={() => handleDelete(item.id)} color="#f87171"
                        disabled={deleting === item.id} loading={deleting === item.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function EventForm({ form, setForm, onSave, onCancel, saving, isEdit }) {
  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const EVENT_TYPES = ['general','townhall','workshop','training','celebration','team_outing','webinar','holiday'];
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--primary)33',
      borderRadius: 14, padding: '24px 28px', marginBottom: 24,
      boxShadow: '0 4px 24px rgba(29,118,188,0.08)',
    }}>
      <h3 style={{ color: 'var(--text)', fontSize: 15, fontWeight: 700, margin: '0 0 20px' }}>
        <i className="fas fa-calendar-plus" style={{ color: 'var(--primary)', marginRight: 8 }} />
        {isEdit ? 'Edit Event' : 'New Event'}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Title *</Label>
          <Input value={form.title} onChange={f('title')} placeholder="Event title" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={f('description')} placeholder="What's this event about?" rows={3} />
        </div>
        <div>
          <Label>Event Type</Label>
          <Select value={form.event_type} onChange={f('event_type')} options={EVENT_TYPES} />
        </div>
        <div>
          <Label>Event Status</Label>
          <Select value={form.status} onChange={f('status')} options={['upcoming','live','completed','cancelled']} />
        </div>
        <div>
          <Label>Publish Status</Label>
          <Select value={form.publish_status} onChange={f('publish_status')} options={['draft','published','archived']} />
        </div>
        <div>
          <Label>Timezone</Label>
          <Input value={form.timezone} onChange={f('timezone')} placeholder="Asia/Kolkata" />
        </div>
        <div>
          <Label>Starts At *</Label>
          <Input type="datetime-local" value={form.starts_at} onChange={f('starts_at')} />
        </div>
        <div>
          <Label>Ends At</Label>
          <Input type="datetime-local" value={form.ends_at} onChange={f('ends_at')} />
        </div>
        <div>
          <Label>Location / Venue</Label>
          <Input value={form.location} onChange={f('location')} placeholder="Conference room / address" />
        </div>
        <div>
          <Label>Cover Image URL</Label>
          <Input value={form.cover_image_url} onChange={f('cover_image_url')} placeholder="https://…" />
        </div>
        <div>
          <Label>Virtual Link</Label>
          <Input value={form.virtual_link} onChange={f('virtual_link')} placeholder="https://meet.google.com/…" />
        </div>
        <div>
          <Label>Max Attendees</Label>
          <Input type="number" value={form.max_attendees} onChange={f('max_attendees')} placeholder="Leave blank for unlimited" />
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_virtual} onChange={f('is_virtual')} />
            Virtual event
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.rsvp_enabled} onChange={f('rsvp_enabled')} />
            Enable RSVP
          </label>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
        <button onClick={onSave} disabled={saving} style={primaryBtn}>
          {saving ? <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} /> : <i className="fas fa-check" style={{ marginRight: 6 }} />}
          {isEdit ? 'Save Changes' : 'Create'}
        </button>
      </div>
    </div>
  );
}

// ── Shared mini-components ─────────────────────────────────────────────────

function Label({ children }) {
  return (
    <p style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 5px' }}>
      {children}
    </p>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-elevated)', color: 'var(--text)',
        border: '1px solid var(--border)', borderRadius: 8,
        padding: '8px 12px', fontSize: 13,
        outline: 'none', fontFamily: 'inherit',
        ...props.style,
      }}
    />
  );
}

function Textarea({ ...props }) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-elevated)', color: 'var(--text)',
        border: '1px solid var(--border)', borderRadius: 8,
        padding: '8px 12px', fontSize: 13, resize: 'vertical',
        outline: 'none', fontFamily: 'inherit',
        ...props.style,
      }}
    />
  );
}

function Select({ options, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-elevated)', color: 'var(--text)',
        border: '1px solid var(--border)', borderRadius: 8,
        padding: '8px 12px', fontSize: 13,
        outline: 'none', fontFamily: 'inherit',
        ...props.style,
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ActionBtn({ label, icon, onClick, color, disabled, loading: isLoading }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        background:  'none',
        border:      `1px solid ${color}55`,
        color,
        borderRadius: 6,
        padding:     '4px 10px',
        fontSize:    12,
        cursor:      disabled ? 'default' : 'pointer',
        opacity:     disabled ? 0.5 : 1,
        display:     'flex', alignItems: 'center', gap: 4,
        transition:  'all 0.15s',
      }}
    >
      <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : icon}`} style={{ fontSize: 11 }} />
      {label}
    </button>
  );
}

function LoadingRows() {
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 20, marginBottom: 8, display: 'block' }} />
      Loading…
    </div>
  );
}

function EmptyPlaceholder({ icon, label }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 0' }}>
      <i className={`fas ${icon}`} style={{ fontSize: 28, color: 'var(--border)', marginBottom: 10, display: 'block' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>{label}</p>
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────

const thStyle = {
  padding: '10px 16px', textAlign: 'left',
  fontSize: 11, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
};

const primaryBtn = {
  background:  'var(--primary)',
  color:       '#fff',
  border:      'none',
  borderRadius: 8,
  padding:     '8px 18px',
  fontSize:    13,
  fontWeight:  600,
  cursor:      'pointer',
  display:     'flex',
  alignItems:  'center',
};

const cancelBtn = {
  background:  'var(--bg-elevated)',
  color:       'var(--text-secondary)',
  border:      '1px solid var(--border)',
  borderRadius: 8,
  padding:     '8px 16px',
  fontSize:    13,
  cursor:      'pointer',
};
