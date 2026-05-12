import React from 'react';

const DocumentPanel = ({ documents, handleUploadDoc }) => {
  const uploadedCount = documents.filter(d => d.uploaded).length;

  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-folder-open" />
          Required Documents
        </span>
        <span className="og-checklist-counter">
          {uploadedCount}/{documents.length}
        </span>
      </div>

      <div className="og-doc-list">
        {documents.map((doc) => (
          <div key={doc.id} className="og-doc-item">
            <div
              className="og-doc-icon"
              style={{
                background: doc.uploaded
                  ? 'rgba(78,212,78,0.12)'
                  : 'rgba(240,82,82,0.1)',
                color: doc.uploaded ? 'var(--secondary)' : 'var(--error)',
              }}
            >
              <i className={`fas ${doc.uploaded ? 'fa-file-check' : 'fa-file-upload'}`} />
            </div>

            <div className="og-doc-info">
              <div className="og-doc-name">{doc.label}</div>
              {doc.uploaded && doc.fileName ? (
                <div className="og-doc-filename">
                  <i className="fas fa-paperclip" style={{ marginRight: 4, opacity: 0.5 }} />
                  {doc.fileName}
                </div>
              ) : (
                <div className="og-doc-filename" style={{ color: 'var(--error)', opacity: 0.8 }}>
                  {doc.required ? 'Required — not uploaded' : 'Optional'}
                </div>
              )}
            </div>

            <div className="og-doc-action">
              {doc.uploaded ? (
                <span className="og-badge og-badge-uploaded">
                  <i className="fas fa-check" />
                  Done
                </span>
              ) : (
                <button
                  className="og-upload-btn"
                  onClick={() => handleUploadDoc(doc.id)}
                  aria-label={`Upload ${doc.label}`}
                >
                  <i className="fas fa-cloud-upload-alt" />
                  Upload
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentPanel;
