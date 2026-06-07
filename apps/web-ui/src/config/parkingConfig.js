// Single source of truth for parking charge data.
// Imported by ChatWindow, ParkingDrawer, and any future parking UI.

// ── Charge data ───────────────────────────────────────────────────────────────

export const PARKING_CHARGES = {
  '2W': [
    { id: 'monthly_aaspl',      option: 'Monthly Parking (AASPL)', charge: '₹800/mo',   perDay: null,   remarks: 'Through AASPL' },
    { id: 'daily_fountainhead', option: 'Daily Parking',           charge: '₹50/day',   perDay: 50,     remarks: 'Pay directly at Fountainhead entry point' },
  ],
  '4W': [
    { id: 'monthly_aaspl',      option: 'Monthly Parking (AASPL)', charge: '₹4,500/mo', perDay: null,   remarks: 'Through AASPL' },
    { id: 'daily_fountainhead', option: 'Daily Pass',              charge: '₹150/day',  perDay: 150,    remarks: 'Single entry & exit only; extra charges for multiple entries/exits (Fountainhead)' },
    { id: 'monthly_fountainhead', option: 'Monthly Pass',          charge: '₹2,500/mo', perDay: null,   remarks: 'Unlimited entries & exits (Fountainhead)' },
  ],
};

// Options available as a dropdown for 4W in the form
export const PARKING_OPTIONS_4W = PARKING_CHARGES['4W'].map(r => ({
  value: r.id,
  label: `${r.option} — ${r.charge}`,
}));

// ── Status metadata (shared with ParkingDrawer) ───────────────────────────────

export const STATUS_META = {
  pending:                { label: 'Pending Review',       color: '#f59e0b' },
  approved:               { label: 'Approved',             color: '#1D76BC' },
  rejected:               { label: 'Rejected',             color: '#f05252' },
  sticker_issued:         { label: 'Sticker Issued',       color: '#4ED44E' },
  closed:                 { label: 'Closed',               color: '#6b7280' },
  deactivation_requested: { label: 'Deactivation Pending', color: '#f59e0b' },
  deactivated:            { label: 'Deactivated',          color: '#6b7280' },
};

export function getParkingOptionLabel(optionId, category) {
  const rows = category ? PARKING_CHARGES[category] : [...PARKING_CHARGES['2W'], ...PARKING_CHARGES['4W']];
  const found = rows.find(r => r.id === optionId);
  return found ? `${found.option} (${found.charge})` : optionId;
}

// ── HTML card builder — used by ChatWindow ────────────────────────────────────

function chargeRow(r) {
  return (
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;` +
    `padding:9px 12px;background:var(--bg-secondary,#0f1c3f);border-radius:8px;margin-bottom:6px;">` +
      `<div style="flex:1;min-width:0;margin-right:10px;">` +
        `<div style="font-weight:600;font-size:13px;color:var(--text,#fff);">${r.option}</div>` +
        `<div style="font-size:11px;color:var(--text-muted,#5e7a9a);margin-top:2px;">${r.remarks}</div>` +
      `</div>` +
      `<div style="font-size:14px;font-weight:700;color:#4ED44E;white-space:nowrap;">${r.charge}</div>` +
    `</div>`
  );
}

function chargeSection(emoji, label, accentColor, rows) {
  return (
    `<div style="border:1px solid ${accentColor}30;border-radius:10px;padding:12px 14px;margin-bottom:10px;">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">` +
        `<span style="font-size:17px;">${emoji}</span>` +
        `<span style="font-weight:700;font-size:12px;color:${accentColor};text-transform:uppercase;letter-spacing:.06em;">${label}</span>` +
      `</div>` +
      rows.map(chargeRow).join('') +
    `</div>`
  );
}

/**
 * Builds the parking charges HTML card for the chat.
 * @param {boolean} hasRequest  - true if the user already has an active request
 */
export function buildParkingHtml(hasRequest = false) {
  const twoW  = chargeSection('🛵', 'Two-Wheeler (2W)', '#1D76BC', PARKING_CHARGES['2W']);
  const fourW = chargeSection('🚗', 'Four-Wheeler (4W)', '#27AAE1', PARKING_CHARGES['4W']);

  const cta = hasRequest
    ? `<p style="margin:6px 0 0;font-size:12px;color:var(--text-muted,#5e7a9a);">` +
      `✅ You already have a parking request on file. ` +
      `<a href="#parking-status" style="color:#1D76BC;font-weight:600;text-decoration:none;">View request status →</a></p>`
    : `<p style="margin:6px 0 0;font-size:11px;color:var(--text-muted,#5e7a9a);">` +
      `💡 To apply for a sticker, say <strong style="color:var(--text,#fff);">"Apply for parking sticker"</strong> and I'll open the form.</p>`;

  return (
    `<div>` +
    `<p style="margin:0 0 12px;font-size:13px;color:var(--text,#fff);">Here are the <strong>Parking Charges</strong> at Fountainhead:</p>` +
    twoW + fourW + cta +
    `</div>`
  );
}

/**
 * Builds the "already submitted" HTML card shown in chat when the user tries to apply again.
 * @param {{ status: string }} existing  - the existing parking request object
 */
export function buildAlreadySubmittedHtml(existing) {
  const meta   = STATUS_META[existing.status] || STATUS_META.pending;
  const color  = meta.color;
  const label  = meta.label;

  return (
    `<div style="background:#1D76BC0d;border:1px solid #1D76BC30;border-radius:10px;padding:14px 16px;">` +
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">` +
        `<span style="font-size:20px;">🅿️</span>` +
        `<strong style="font-size:14px;color:var(--text,#fff);">Parking Request Already Submitted</strong>` +
      `</div>` +
      `<p style="margin:0 0 12px;font-size:13px;color:var(--text,#fff);">` +
        `You've already submitted a parking sticker request. Current status: ` +
        `<strong style="color:${color};">${label}</strong>.` +
      `</p>` +
      `<a href="#parking-status" style="display:inline-block;padding:8px 16px;background:#1D76BC;` +
      `color:#fff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">` +
        `📋 View Request Status` +
      `</a>` +
    `</div>`
  );
}

// Static default used when request status is unknown (module load time)
export const PARKING_COST_RESPONSE = buildParkingHtml(false);
