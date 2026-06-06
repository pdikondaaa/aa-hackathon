import React, { useState, useEffect } from 'react';

const SECTIONS = [
  {
    key: 'personal',
    title: 'Personal Info',
    icon: 'fa-user-circle',
    accent: '#1d76bc',
    fields: [
      { label: 'Full Name',   icon: 'fa-user',     key: 'name'            },
      { label: 'Employee ID', icon: 'fa-id-badge', key: 'empId'           },
      { label: 'Work Email',  icon: 'fa-envelope', key: 'email', full: true },
    ],
  },
  {
    key: 'work',
    title: 'Work Details',
    icon: 'fa-briefcase',
    accent: '#7c3aed',
    fields: [
      { label: 'Department', icon: 'fa-building',  key: 'department' },
      { label: 'Job Title',  icon: 'fa-briefcase', key: 'jobTitle'   },
      { label: 'Start Date', icon: 'fa-calendar',  key: 'startDate'  },
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    icon: 'fa-address-book',
    accent: '#059669',
    fields: [
      { label: 'Phone',             icon: 'fa-phone', key: 'phone'     },
      { label: 'Emergency Contact', icon: 'fa-heart', key: 'emergency' },
    ],
  },
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

  const initials = (fields.name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="og-step-content og-profile-step">

      {/* Gradient banner */}
      <div className="og-profile-avatar-row">
        <div className="og-profile-avatar">{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="og-profile-avatar-name">{fields.name || 'New Employee'}</div>
          <div className="og-profile-avatar-role">
            {[fields.jobTitle, fields.department].filter(Boolean).join(' · ') || 'Complete your profile below'}
          </div>
        </div>
        {fields.empId && (
          <div className="og-profile-emp-badge">
            <i className="fas fa-id-badge" /> {fields.empId}
          </div>
        )}
      </div>

      {/* Section cards */}
      {SECTIONS.map(section => (
        <div key={section.key} className="og-profile-section">
          <div className="og-profile-section-header">
            <div className="og-profile-section-icon" style={{ background: section.accent }}>
              <i className={`fas ${section.icon}`} />
            </div>
            <span className="og-profile-section-title">{section.title}</span>
          </div>
          <div className="og-profile-section-body">
            {section.fields.map(f => (
              <div key={f.key} className={`og-profile-field${f.full ? ' full' : ''}`}>
                <label className="og-profile-label">{f.label}</label>
                <div className="og-profile-input-wrap">
                  <i className={`fas ${f.icon} og-profile-input-icon`} />
                  <input
                    type="text"
                    className="og-profile-input"
                    value={fields[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    aria-label={f.label}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="og-step-footer">
        <div className="og-completion-note">
          <i className="fas fa-info-circle" style={{ color: 'var(--primary)', marginRight: 6 }} />
          Employment details are pre-filled by HR. Update personal info as needed.
        </div>
        <button className="og-btn-primary" onClick={handleSave}>
          <i className="fas fa-save" /> Save &amp; Continue
        </button>
      </div>
    </div>
  );
};

export default ProfileStep;
