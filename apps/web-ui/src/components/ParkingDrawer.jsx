import React, { useState, useEffect, useRef } from 'react';
import { parkingApi } from '../modules/parking-assistant/services/parkingApi';
import { PARKING_CHARGES, PARKING_OPTIONS_4W, STATUS_META, getParkingOptionLabel } from '../config/parkingConfig';

const LOCATIONS = ['T2 08', 'T2 10', 'T3 06', 'T3 08'];
const FOUNTAINHEAD_EMAILS = { 'T2': 't2.fountainhead@mall.com', 'T3': 't3.fountainhead@mall.com' };

// Re-add icon mapping not in shared config
const STATUS_ICON = {
  pending:                'fa-clock',
  approved:               'fa-check-circle',
  rejected:               'fa-times-circle',
  sticker_issued:         'fa-id-card',
  closed:                 'fa-lock',
  deactivation_requested: 'fa-hourglass-half',
  deactivated:            'fa-ban',
};

const TIMELINE_STEPS = [
  { key: 'submitted',           label: 'Request Submitted'      },
  { key: 'approved',            label: 'Admin Approved'         },
  { key: 'fountainhead_notify', label: 'Fountainhead Notified'  },
  { key: 'sticker_issued',      label: 'Sticker / RFID Issued'  },
  { key: 'closed',              label: 'Request Closed'         },
];

function getTimelineStep(status) {
  if (!status || status === 'pending')                return 0;
  if (status === 'approved')                          return 1;
  if (status === 'sticker_issued')                    return 3;
  if (status === 'closed' || status === 'deactivated') return 4;
  return 0;
}

function fmt(val) {
  if (!val) return '—';
  if (val instanceof Date) return val.toLocaleDateString();
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/))
    return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return val;
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    zIndex: 1200, display: 'flex', justifyContent: 'flex-end',
  },
  drawer: {
    width: '480px', maxWidth: '95vw', height: '100vh',
    background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', overflowY: 'hidden',
    fontFamily: 'var(--font)',
  },
  header: {
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerIcon: {
    width: 36, height: 36, borderRadius: '8px',
    background: '#1D76BC20', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1D76BC', fontSize: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 },
  headerSub: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6,
  },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  section: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
    outline: 'none',
  },
  inputDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  select: {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
    outline: 'none', cursor: 'pointer',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fieldGroup: { marginBottom: 14 },
  required: { color: '#f05252', marginLeft: 2 },
  badge: (status) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: `${(STATUS_META[status] || STATUS_META.pending).color}20`,
    color: (STATUS_META[status] || STATUS_META.pending).color,
  }),
  detailCard: {
    background: 'var(--bg-elevated)', borderRadius: 10,
    border: '1px solid var(--border)', padding: '16px',
    marginBottom: 16,
  },
  detailRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 },
  detailKey: { color: 'var(--text-muted)', flex: '0 0 45%' },
  detailVal: { color: 'var(--text)', fontWeight: 500, textAlign: 'right', flex: '0 0 53%', wordBreak: 'break-word' },
  timeline: { display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 },
  timelineStep: (active, done) => ({
    display: 'flex', gap: 12, alignItems: 'flex-start', paddingBottom: 16, position: 'relative',
  }),
  timelineDot: (active, done) => ({
    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
    background: done ? '#1D76BC' : active ? '#1D76BC30' : 'var(--bg-elevated)',
    border: `2px solid ${done || active ? '#1D76BC' : 'var(--border)'}`,
    color: done ? '#fff' : active ? '#1D76BC' : 'var(--text-muted)',
    zIndex: 1,
  }),
  timelineLine: (done) => ({
    position: 'absolute', left: 13, top: 28, width: 2, height: 16,
    background: done ? '#1D76BC' : 'var(--border)',
  }),
  timelineLabel: (active, done) => ({
    fontSize: 13, fontWeight: done || active ? 600 : 400,
    color: done || active ? 'var(--text)' : 'var(--text-muted)',
    paddingTop: 4,
  }),
  footer: {
    padding: '16px 24px', borderTop: '1px solid var(--border)',
    background: 'var(--bg-elevated)', flexShrink: 0,
    display: 'flex', gap: 10,
  },
  primaryBtn: {
    flex: 1, padding: '11px', borderRadius: 8,
    background: '#1D76BC', color: '#fff',
    border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  secondaryBtn: {
    flex: 1, padding: '11px', borderRadius: 8,
    background: 'transparent', color: 'var(--text)',
    border: '1px solid var(--border)', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  dangerBtn: {
    flex: 1, padding: '11px', borderRadius: 8,
    background: 'transparent', color: '#f05252',
    border: '1px solid #f05252', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  errorMsg: {
    color: '#f05252', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4,
  },
  photoUpload: {
    border: '2px dashed var(--border)', borderRadius: 8, padding: '16px',
    textAlign: 'center', cursor: 'pointer', background: 'var(--bg-elevated)',
    transition: 'border-color 0.2s',
  },
  photoPreview: {
    width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 8, marginTop: 8,
  },
  successBox: {
    background: '#4ED44E15', border: '1px solid #4ED44E40', borderRadius: 10,
    padding: '16px', textAlign: 'center', marginBottom: 16,
  },
  loadingBox: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column', gap: 12, padding: '40px 0', color: 'var(--text-muted)',
  },
  pricingCard: {
    background: '#1D76BC0d', border: '1px solid #1D76BC30', borderRadius: 10,
    padding: '14px 16px', marginBottom: 16,
  },
  pricingTitle: {
    fontSize: 12, fontWeight: 700, color: '#1D76BC', marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    display: 'flex', alignItems: 'center', gap: 6,
  },
  pricingTable: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  pricingTh: {
    textAlign: 'left', padding: '5px 8px', fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  pricingTd: { padding: '6px 8px', color: 'var(--text)', verticalAlign: 'top' },
  pricingCharge: { fontWeight: 700, color: '#4ED44E', whiteSpace: 'nowrap' },
  pricingRemarks: { color: 'var(--text-muted)', fontSize: 12 },
  pricingRowSelected: {
    background: '#1D76BC18',
    borderLeft: '3px solid #1D76BC',
    borderRadius: '0 6px 6px 0',
  },
  selectedChip: {
    display: 'inline-block', padding: '1px 6px', marginLeft: 6,
    background: '#1D76BC', color: '#fff', fontSize: 10,
    fontWeight: 700, borderRadius: 4, verticalAlign: 'middle',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const icon = STATUS_ICON[status] || STATUS_ICON.pending;
  return (
    <span style={s.badge(status)}>
      <i className={`fas ${icon}`} />
      {meta.label}
    </span>
  );
}

function Timeline({ status }) {
  const activeStep = getTimelineStep(status);
  return (
    <div style={s.timeline}>
      {TIMELINE_STEPS.map((step, i) => {
        const done   = i < activeStep;
        const active = i === activeStep;
        const last   = i === TIMELINE_STEPS.length - 1;
        return (
          <div key={step.key} style={s.timelineStep(active, done)}>
            {!last && <div style={s.timelineLine(done)} />}
            <div style={s.timelineDot(active, done)}>
              {done ? <i className="fas fa-check" /> : i + 1}
            </div>
            <div style={s.timelineLabel(active, done)}>{step.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function DetailCard({ request }) {
  const categoryLabel = request.category === '2W' ? 'Two-Wheeler (2W)' : request.category === '4W' ? 'Four-Wheeler (4W)' : request.category;
  const optionLabel   = request.parking_option ? getParkingOptionLabel(request.parking_option, request.category) : '—';
  const rows = [
    ['Employee ID',          request.employee_id],
    ['Employee Name',        request.employee_name],
    ['Location',             request.location],
    ['Category',             categoryLabel],
    ['Parking Option',       optionLabel],
    ['Owner Name',           request.owner_name],
    ['Vehicle Reg. #',       request.vehicle_reg_no],
    ['Vehicle Make',         request.vehicle_make],
    ['Vehicle Model',        request.vehicle_model],
    ['Sticker Date',         fmt(request.sticker_required_date)],
    ['Parking Sticker/RFID', request.parking_sticker_rfid_no || '—'],
    ['Submitted On',         fmt(request.submitted_at)],
  ];
  return (
    <div style={s.detailCard}>
      {rows.map(([k, v]) => (
        <div key={k} style={s.detailRow}>
          <span style={s.detailKey}>{k}</span>
          <span style={s.detailVal}>{v || '—'}</span>
        </div>
      ))}
      {request.admin_remarks && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <div style={{ ...s.detailKey, marginBottom: 4 }}>Admin Remarks</div>
          <div style={{ color: 'var(--text)', fontSize: 13 }}>{request.admin_remarks}</div>
        </div>
      )}
    </div>
  );
}

function PricingCard({ category, selectedOption }) {
  const rows2W   = PARKING_CHARGES['2W'];
  const rows4W   = PARKING_CHARGES['4W'];
  const showBoth = !category;

  const renderRows = (rows) =>
    rows.map((r) => {
      const isSelected = selectedOption && r.id === selectedOption;
      return (
        <tr key={r.id} style={isSelected ? s.pricingRowSelected : {}}>
          <td style={s.pricingTd}>
            {r.option}
            {isSelected && <span style={s.selectedChip}>Selected</span>}
          </td>
          <td style={{ ...s.pricingTd, ...s.pricingCharge }}>{r.charge}</td>
          <td style={{ ...s.pricingTd, ...s.pricingRemarks }}>{r.remarks}</td>
        </tr>
      );
    });

  const renderSection = (label, rows) => (
    <>
      {showBoth && (
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
          {label}
        </div>
      )}
      <table style={s.pricingTable}>
        <thead>
          <tr>
            <th style={s.pricingTh}>Option</th>
            <th style={s.pricingTh}>Charges</th>
            <th style={s.pricingTh}>Remarks</th>
          </tr>
        </thead>
        <tbody>{renderRows(rows)}</tbody>
      </table>
    </>
  );

  return (
    <div style={s.pricingCard}>
      <div style={s.pricingTitle}>
        <i className="fas fa-indian-rupee-sign" />
        Applicable Parking Charges
      </div>

      {(showBoth || category === '2W') && renderSection('Two-Wheeler (2W)', rows2W)}
      {showBoth && <div style={{ height: 10 }} />}
      {(showBoth || category === '4W') && renderSection('Four-Wheeler (4W)', rows4W)}
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────

export default function ParkingDrawer({ isOpen, onClose, user }) {
  const [view, setView]             = useState('loading'); // loading | existing | form | deactivate | success
  const [existingReq, setExistingReq] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors]         = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef               = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    location: '',
    category: '',
    parking_option: '',
    owner_name: '',
    vehicle_reg_no: '',
    vehicle_make: '',
    vehicle_model: '',
    sticker_required_date: '',
    vehicle_photo_b64: '',
  });

  const [deactForm, setDeactForm] = useState({ deactivation_date: today });

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setView('loading');
    setErrors({});
    setPhotoPreview(null);
    setDeactForm({ deactivation_date: today });
    setForm({ location: '', category: '', parking_option: '', owner_name: '', vehicle_reg_no: '', vehicle_make: '', vehicle_model: '', sticker_required_date: '', vehicle_photo_b64: '' });

    parkingApi.getMyRequest()
      .then((res) => {
        if (res && res.id) {
          setExistingReq(res);
          setView('existing');
        } else {
          setView('form');
        }
      })
      .catch(() => setView('form'));
  }, [isOpen]);

  if (!isOpen) return null;

  const employeeId   = user?.employeeId   || '—';
  const employeeName = user?.name         || '—';

  // ── Handlers ────────────────────────────────────────────────────────────────

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target.result);
      setField('vehicle_photo_b64', ev.target.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const validate = () => {
    const errs = {};
    if (!form.location)              errs.location              = 'Location is required';
    if (!form.category)              errs.category              = 'Category is required';
    if (form.category === '4W' && !form.parking_option)
                                     errs.parking_option        = 'Please select a parking option';
    if (!form.owner_name.trim())     errs.owner_name            = 'Owner name is required';
    if (!form.vehicle_reg_no.trim()) errs.vehicle_reg_no        = 'Vehicle registration number is required';
    if (!form.vehicle_make.trim())   errs.vehicle_make          = 'Vehicle make is required';
    if (!form.vehicle_model.trim())  errs.vehicle_model         = 'Vehicle model is required';
    if (!form.sticker_required_date) errs.sticker_required_date = 'Sticker requirement date is required';
    if (!form.vehicle_photo_b64)     errs.vehicle_photo_b64     = 'Vehicle photograph is mandatory';
    return errs;
  };

  const handleSubmitRequest = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      await parkingApi.submitRequest({
        employee_id:           employeeId,
        employee_name:         employeeName,
        location:              form.location,
        category:              form.category,
        parking_option:        form.category === '4W' ? form.parking_option : 'monthly_aaspl',
        owner_name:            form.owner_name,
        vehicle_reg_no:        form.vehicle_reg_no,
        vehicle_make:          form.vehicle_make,
        vehicle_model:         form.vehicle_model,
        sticker_required_date: form.sticker_required_date,
        vehicle_photo_b64:     form.vehicle_photo_b64,
      });
      setView('success');
    } catch (err) {
      setErrors({ submit: err?.message || 'Failed to submit request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDeactivation = async () => {
    if (!existingReq?.id) return;
    setSubmitting(true);
    try {
      await parkingApi.submitDeactivation({
        request_id:        existingReq.id,
        deactivation_date: deactForm.deactivation_date,
      });
      setView('success');
    } catch (err) {
      setErrors({ submit: err?.message || 'Failed to submit deactivation request. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const canDeactivate = existingReq && ['approved', 'sticker_issued'].includes(existingReq.status);
  const isActiveRequest = existingReq && !['closed', 'deactivated', 'rejected'].includes(existingReq.status);

  const renderLoading = () => (
    <div style={s.loadingBox}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: '#1D76BC' }} />
      <span>Loading parking status…</span>
    </div>
  );

  const renderExisting = () => (
    <>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Your Parking Request</div>
        <StatusBadge status={existingReq.status} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={s.label}>Progress</div>
        <Timeline status={existingReq.status} />
      </div>

      <div style={s.label}>Request Details</div>
      <DetailCard request={existingReq} />

      {existingReq.deactivation_requested_at && (
        <div style={{ background: '#f59e0b15', border: '1px solid #f59e0b40', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f59e0b', marginBottom: 12 }}>
          <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
          Deactivation requested on {fmt(existingReq.deactivation_requested_at)}
          {existingReq.deactivation_date && ` — effective ${fmt(existingReq.deactivation_date)}`}
        </div>
      )}
    </>
  );

  const renderForm = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>New Parking Application</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Fill in the details below. Fields marked <span style={{ color: '#f05252' }}>*</span> are required.
        </div>
      </div>

      {/* Auto-filled fields */}
      <div style={s.row2}>
        <div style={s.fieldGroup}>
          <label style={s.label}>Employee ID</label>
          <input style={{ ...s.input, ...s.inputDisabled }} value={employeeId} readOnly />
        </div>
        <div style={s.fieldGroup}>
          <label style={s.label}>Employee Name</label>
          <input style={{ ...s.input, ...s.inputDisabled }} value={employeeName} readOnly />
        </div>
      </div>

      {/* Location + Category */}
      <div style={s.row2}>
        <div style={s.fieldGroup}>
          <label style={s.label}>Location <span style={s.required}>*</span></label>
          <select style={s.select} value={form.location} onChange={e => setField('location', e.target.value)}>
            <option value="">Select…</option>
            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {errors.location && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.location}</div>}
        </div>
        <div style={s.fieldGroup}>
          <label style={s.label}>Category <span style={s.required}>*</span></label>
          <select
            style={s.select}
            value={form.category}
            onChange={e => { setField('category', e.target.value); setField('parking_option', ''); }}
          >
            <option value="">Select…</option>
            <option value="2W">Two-Wheeler (2W)</option>
            <option value="4W">Four-Wheeler (4W)</option>
          </select>
          {errors.category && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.category}</div>}
        </div>
      </div>

      {/* Parking option — only for 4W */}
      {form.category === '4W' && (
        <div style={s.fieldGroup}>
          <label style={s.label}>Parking Option <span style={s.required}>*</span></label>
          <select
            style={s.select}
            value={form.parking_option}
            onChange={e => setField('parking_option', e.target.value)}
          >
            <option value="">Select parking option…</option>
            {PARKING_OPTIONS_4W.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {errors.parking_option && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.parking_option}</div>}
        </div>
      )}

      {/* Pricing info — updates dynamically based on category + option */}
      <PricingCard category={form.category} selectedOption={form.parking_option} />

      {/* Owner name */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Regd. Name of Owner <span style={s.required}>*</span></label>
        <input style={s.input} placeholder="As per vehicle RC" value={form.owner_name} onChange={e => setField('owner_name', e.target.value)} />
        {errors.owner_name && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.owner_name}</div>}
      </div>

      {/* Vehicle reg */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Vehicle Reg. # <span style={s.required}>*</span></label>
        <input style={s.input} placeholder="e.g. MH12AB1234" value={form.vehicle_reg_no} onChange={e => setField('vehicle_reg_no', e.target.value.toUpperCase())} />
        {errors.vehicle_reg_no && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.vehicle_reg_no}</div>}
      </div>

      {/* Make + Model */}
      <div style={s.row2}>
        <div style={s.fieldGroup}>
          <label style={s.label}>Vehicle Make <span style={s.required}>*</span></label>
          <input style={s.input} placeholder="e.g. Honda" value={form.vehicle_make} onChange={e => setField('vehicle_make', e.target.value)} />
          {errors.vehicle_make && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.vehicle_make}</div>}
        </div>
        <div style={s.fieldGroup}>
          <label style={s.label}>Vehicle Model <span style={s.required}>*</span></label>
          <input style={s.input} placeholder="e.g. City" value={form.vehicle_model} onChange={e => setField('vehicle_model', e.target.value)} />
          {errors.vehicle_model && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.vehicle_model}</div>}
        </div>
      </div>

      {/* Sticker date */}
      <div style={s.fieldGroup}>
        <label style={s.label}>Require Parking Sticker From <span style={s.required}>*</span></label>
        <input type="date" style={s.input} min={today} value={form.sticker_required_date} onChange={e => setField('sticker_required_date', e.target.value)} />
        {errors.sticker_required_date && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.sticker_required_date}</div>}
      </div>

      {/* Photo upload */}
      <div style={s.fieldGroup}>
        <label style={s.label}>
          Vehicle Front Photo with Nameplate <span style={s.required}>*</span>
        </label>
        <div
          style={{ ...s.photoUpload, borderColor: errors.vehicle_photo_b64 ? '#f05252' : 'var(--border)' }}
          onClick={() => photoInputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && photoInputRef.current?.click()}
        >
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Vehicle preview" style={s.photoPreview} />
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Click to change</div>
            </>
          ) : (
            <>
              <i className="fas fa-camera" style={{ fontSize: 28, color: 'var(--text-muted)', marginBottom: 6 }} />
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Click to upload vehicle photo</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>Front view with number plate visible (JPG/PNG)</div>
            </>
          )}
        </div>
        {errors.vehicle_photo_b64 && <div style={s.errorMsg}><i className="fas fa-exclamation-circle" />{errors.vehicle_photo_b64}</div>}
      </div>

      {errors.submit && (
        <div style={{ ...s.errorMsg, marginTop: 8, fontSize: 13, background: '#f0525215', padding: '8px 12px', borderRadius: 6 }}>
          <i className="fas fa-exclamation-circle" />{errors.submit}
        </div>
      )}
    </>
  );

  const renderDeactivate = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <button style={{ ...s.secondaryBtn, flex: 'none', padding: '6px 14px', fontSize: 13, marginBottom: 14 }} onClick={() => setView('existing')}>
          <i className="fas fa-arrow-left" style={{ marginRight: 6 }} />Back
        </button>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Request Deactivation</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Submit to surrender your parking sticker / RFID card to Fountainhead.</div>
      </div>

      <div style={s.detailCard}>
        {[
          ['Employee ID',    existingReq?.employee_id],
          ['Employee Name',  existingReq?.employee_name],
          ['Location',       existingReq?.location],
          ['Owner Name',     existingReq?.owner_name],
          ['Category',       existingReq?.category],
          ['Vehicle Reg. #', existingReq?.vehicle_reg_no],
          ['Vehicle Make',   existingReq?.vehicle_make],
          ['Vehicle Model',  existingReq?.vehicle_model],
          ['Sticker/RFID #', existingReq?.parking_sticker_rfid_no || '—'],
        ].map(([k, v]) => (
          <div key={k} style={s.detailRow}>
            <span style={s.detailKey}>{k}</span>
            <span style={s.detailVal}>{v || '—'}</span>
          </div>
        ))}
      </div>

      <div style={s.fieldGroup}>
        <label style={s.label}>Deactivation Request Date</label>
        <input type="date" style={s.input} value={deactForm.deactivation_date} onChange={e => setDeactForm(p => ({ ...p, deactivation_date: e.target.value }))} />
      </div>

      {errors.submit && (
        <div style={{ ...s.errorMsg, fontSize: 13, background: '#f0525215', padding: '8px 12px', borderRadius: 6 }}>
          <i className="fas fa-exclamation-circle" />{errors.submit}
        </div>
      )}
    </>
  );

  const renderSuccess = () => (
    <div style={{ padding: '20px 0' }}>
      <div style={s.successBox}>
        <i className="fas fa-check-circle" style={{ fontSize: 40, color: '#4ED44E', marginBottom: 10 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {view === 'success' && existingReq && existingReq.deactivation_requested_at
            ? 'Deactivation Requested'
            : 'Application Submitted!'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Your request has been submitted. Admin will review and notify you at your registered email.
        </div>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)', padding: '14px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
        <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>What happens next?</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Admin (<strong>admin@company.com</strong>) will review your request</li>
          <li>CC: Surya Prakash Tiwari &amp; Dipali Mane</li>
          <li>Once approved, Fountainhead will be notified</li>
          <li>Sticker / RFID card expected within <strong>2 business days</strong></li>
          <li>You'll receive an email to collect your sticker</li>
        </ul>
      </div>
    </div>
  );

  // ── Footer buttons ───────────────────────────────────────────────────────────
  const renderFooter = () => {
    if (view === 'loading') return null;
    if (view === 'success') {
      return (
        <div style={s.footer}>
          <button style={s.primaryBtn} onClick={onClose}>Close</button>
        </div>
      );
    }
    if (view === 'existing') {
      return (
        <div style={s.footer}>
          {canDeactivate && (
            <button style={s.dangerBtn} onClick={() => { setErrors({}); setView('deactivate'); }}>
              <i className="fas fa-ban" style={{ marginRight: 6 }} />Request Deactivation
            </button>
          )}
          <button style={s.secondaryBtn} onClick={onClose}>Close</button>
        </div>
      );
    }
    if (view === 'deactivate') {
      return (
        <div style={s.footer}>
          <button style={s.dangerBtn} disabled={submitting} onClick={handleSubmitDeactivation}>
            {submitting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Submitting…</> : <><i className="fas fa-ban" style={{ marginRight: 6 }} />Submit Deactivation</>}
          </button>
          <button style={s.secondaryBtn} onClick={() => setView('existing')}>Cancel</button>
        </div>
      );
    }
    if (view === 'form') {
      return (
        <div style={s.footer}>
          <button style={s.primaryBtn} disabled={submitting} onClick={handleSubmitRequest}>
            {submitting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }} />Submitting…</> : <><i className="fas fa-paper-plane" style={{ marginRight: 6 }} />Submit Application</>}
          </button>
          <button style={s.secondaryBtn} onClick={onClose}>Cancel</button>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.drawer} role="dialog" aria-modal="true" aria-label="Parking Application">
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.headerIcon}><i className="fas fa-square-parking" /></div>
            <div>
              <div style={s.headerTitle}>Parking Tracker</div>
              <div style={s.headerSub}>Apply for or manage your parking sticker</div>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>

        {/* Body */}
        <div style={s.body}>
          {view === 'loading'    && renderLoading()}
          {view === 'existing'   && renderExisting()}
          {view === 'form'       && renderForm()}
          {view === 'deactivate' && renderDeactivate()}
          {view === 'success'    && renderSuccess()}
        </div>

        {/* Footer */}
        {renderFooter()}
      </div>
    </div>
  );
}
