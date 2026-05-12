import React, { useState } from 'react';
import { REQUIRED_DOCUMENTS } from '../../constants/onboardingData';

const DocumentsStep = () => {
  const [docs, setDocs] = useState(REQUIRED_DOCUMENTS);

  const handleUpload = (id) => {
    setDocs(prev => prev.map(d =>
      d.id === id ? { ...d, uploaded: true, fileName: 'document.pdf' } : d
    ));
  };

  const uploaded  = docs.filter(d => d.uploaded).length;
  const required  = docs.filter(d => d.required).length;
  const pending   = docs.filter(d => d.required && !d.uploaded).length;

  return (
    <div className="og-step-content">
      <div className="og-step-header">
        <div className="og-step-header-top">
          <div>
            <h2 className="og-step-title">Documents</h2>
            <p className="og-step-subtitle">
              Upload your required documents to complete verification.
            </p>
          </div>

          <div className="og-step-stat-group">
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Uploaded</div>
              <div className="og-step-stat-value">{uploaded}/{docs.length}</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Required</div>
              <div className="og-step-stat-value">{required}</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Pending</div>
              <div className="og-step-stat-value" style={{ color: pending > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {pending}
              </div>
            </div>
          </div>
        </div>
      </div>

      {pending > 0 && (
        <div className="og-alert-banner">
          <i className="fas fa-exclamation-triangle" />
          <span>{pending} required document{pending > 1 ? 's' : ''} still pending upload.</span>
        </div>
      )}

      <div className="og-docs-list">
        {docs.map((doc) => (
          <div key={doc.id} className={`og-doc-row ${doc.uploaded ? 'uploaded' : ''}`}>
            <div
              className="og-doc-row-icon"
              style={{
                background: doc.uploaded ? 'rgba(78,212,78,0.12)' : 'rgba(240,82,82,0.10)',
                color:      doc.uploaded ? 'var(--secondary)'      : 'var(--error)',
              }}
            >
              <i className={`fas ${doc.uploaded ? 'fa-file-check' : 'fa-file-upload'}`} />
            </div>

            <div className="og-doc-row-info">
              <div className="og-doc-row-name">
                {doc.label}
                {doc.required && !doc.uploaded && (
                  <span className="og-badge og-badge-required" style={{ marginLeft: 8 }}>Required</span>
                )}
              </div>
              {doc.uploaded
                ? <div className="og-doc-row-filename"><i className="fas fa-paperclip" style={{ marginRight: 4 }} />{doc.fileName}</div>
                : <div className="og-doc-row-hint">No file uploaded yet</div>
              }
            </div>

            <div className="og-doc-row-action">
              {doc.uploaded ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="og-tool-badge og-tool-badge-done">
                    <i className="fas fa-check-circle" /> Uploaded
                  </span>
                  <button className="og-btn-ghost" style={{ padding: '5px 10px', fontSize: 11 }}>
                    <i className="fas fa-redo" /> Replace
                  </button>
                </div>
              ) : (
                <button className="og-upload-trigger-btn" onClick={() => handleUpload(doc.id)}>
                  <i className="fas fa-cloud-upload-alt" /> Upload
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="og-docs-note">
        <i className="fas fa-lock" style={{ color: 'var(--primary)', marginRight: 6 }} />
        All documents are encrypted and stored securely. Only HR has access to your files.
      </div>
    </div>
  );
};

export default DocumentsStep;
