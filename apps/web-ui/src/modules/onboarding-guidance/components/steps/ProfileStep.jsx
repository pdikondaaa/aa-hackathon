import React, { useState, useEffect } from 'react';

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

const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const ProfileStep = ({ user, employeeData, onNext }) => {
  const [saved, setSaved] = useState(false);
  const [fields, setFields] = useState({
    name:       user?.name  || '',
    email:      user?.email || '',
    empId:      '',
    department: '',
    jobTitle:   '',
    startDate:  '',
    phone:      '',
    emergency:  'Not provided',
  });

  useEffect(() => {
    if (!employeeData) return;
    setFields(prev => ({
      ...prev,
      name:       employeeData.full_name      || prev.name,
      email:      employeeData.email          || prev.email,
      empId:      employeeData.employee_id    || prev.empId,
      department: employeeData.department     || prev.department,
      jobTitle:   employeeData.designation    || prev.jobTitle,
      startDate:  formatDate(employeeData.date_of_joining) || prev.startDate,
      phone:      employeeData.mobile || employeeData.work_phone || prev.phone,
    }));
  }, [employeeData]);

  const handleChange = (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => { setSaved(true); onNext?.(); };

  return (
    <div className="og-step-content og-profile-step">
      {/* Profile avatar row */}
      <div className="og-profile-avatar-row">
        <div className="og-profile-avatar">
          {(fields.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="og-profile-avatar-name">{fields.name}</div>
          <div className="og-profile-avatar-role">{fields.jobTitle} · {fields.department}</div>
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
