import React, { useState } from 'react';

const FIELDS = [
  { label: 'Full Name',        icon: 'fa-user',        key: 'name'       },
  { label: 'Work Email',       icon: 'fa-envelope',    key: 'email'      },
  { label: 'Employee ID',      icon: 'fa-id-badge',    key: 'empId'      },
  { label: 'Department',       icon: 'fa-building',    key: 'department' },
  { label: 'Job Title',        icon: 'fa-briefcase',   key: 'jobTitle'   },
  { label: 'Start Date',       icon: 'fa-calendar',    key: 'startDate'  },
  { label: 'Phone',            icon: 'fa-phone',       key: 'phone'      },
  { label: 'Emergency Contact',icon: 'fa-heart',       key: 'emergency'  },
];

const ProfileStep = ({ user }) => {
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState({
    name:       user?.name       || 'Amol Metkari',
    email:      user?.email      || 'amol.metkari@alignedautomation.com',
    empId:      'AA-2026-0042',
    department: user?.department || 'TSS',
    jobTitle:   user?.jobTitle   || 'Software Engineer',
    startDate:  '28 Apr 2026',
    phone:      '+91 98765 43210',
    emergency:  'Not provided',
  });

  const handleChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => setSaved(true);

  return (
    <div className="og-step-content">
      <div className="og-step-header">
        <div className="og-step-header-top">
          <div>
            <h2 className="og-step-title">Your Profile</h2>
            <p className="og-step-subtitle">Review and complete your personal and employment details.</p>
          </div>
          {saved && (
            <span className="og-saved-badge">
              <i className="fas fa-check" /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Profile avatar row */}
      <div className="og-profile-avatar-row">
        <div className="og-profile-avatar">
          {(fields.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="og-profile-avatar-name">{fields.name}</div>
          <div className="og-profile-avatar-role">{fields.jobTitle} · {fields.department}</div>
          <button className="og-btn-ghost" style={{ marginTop: 6 }}>
            <i className="fas fa-camera" /> Change photo
          </button>
        </div>
      </div>

      {/* Fields grid */}
      <div className="og-profile-grid">
        {FIELDS.map(f => (
          <div key={f.key} className="og-profile-field">
            <label className="og-profile-label">
              <i className={`fas ${f.icon}`} style={{ marginRight: 6, opacity: 0.6 }} />
              {f.label}
            </label>
            <input
              type="text"
              className="og-profile-input"
              value={fields[f.key]}
              onChange={(e) => handleChange(f.key, e.target.value)}
              aria-label={f.label}
            />
          </div>
        ))}
      </div>

      <div className="og-step-footer">
        <div className="og-completion-note">
          <i className="fas fa-info-circle" style={{ color: 'var(--primary)', marginRight: 6 }} />
          Your employment details are pre-filled by HR. Update personal information as needed.
        </div>
        <button className="og-btn-primary" onClick={handleSave}>
          <i className="fas fa-save" /> Save &amp; Continue
        </button>
      </div>
    </div>
  );
};

export default ProfileStep;
