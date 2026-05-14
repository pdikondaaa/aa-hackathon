import React, { useState } from 'react';
import { POLICIES } from '../../constants/onboardingData';

const PolicyStep = ({ user, onNext }) => {
  const [policies, setPolicies]       = useState(POLICIES);
  const [selectedId, setSelectedId]   = useState(POLICIES[0].id);
  const [signerName, setSignerName]   = useState(user?.name || 'Amol Metkari');

  const selectedPolicy = policies.find(p => p.id === selectedId);
  const signedCount    = policies.filter(p => p.signed).length;

  const handleSign = () => {
    setPolicies(prev =>
      prev.map(p => p.id === selectedId ? { ...p, signed: true } : p)
    );
    const next = policies.find(p => !p.signed && p.id !== selectedId);
    if (next) setSelectedId(next.id);
  };

  return (
    <div className="og-step-content">
      <div className="og-policy-layout">
        {/* Left: document list */}
        <div className="og-policy-list-panel">
          {policies.map(p => (
            <div
              key={p.id}
              className={`og-policy-list-item ${selectedId === p.id ? 'active' : ''} ${p.signed ? 'signed' : ''}`}
              onClick={() => setSelectedId(p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setSelectedId(p.id)}
            >
              <div className="og-policy-list-icon">
                <i className={`fas ${p.signed ? 'fa-file-check' : 'fa-file-alt'}`} />
              </div>
              <div className="og-policy-list-text">
                <div className="og-policy-list-title">{p.title}</div>
                <div className="og-policy-list-meta">{p.pages} pages</div>
              </div>
              {p.signed && (
                <i className="fas fa-check-circle og-policy-signed-icon" />
              )}
            </div>
          ))}

          <div className="og-policy-ack-count">
            <div className="og-policy-ack-label">Acknowledgement</div>
            <div className="og-policy-ack-value">
              {signedCount}<span className="og-policy-ack-total">/{policies.length}</span>
            </div>
          </div>
        </div>

        {/* Right: document viewer */}
        <div className="og-policy-viewer">
          {selectedPolicy && (
            <>
              <div className="og-policy-viewer-header">
                <div>
                  <div className="og-policy-viewer-title">{selectedPolicy.title}</div>
                  <div className="og-policy-viewer-meta">
                    {selectedPolicy.version} · Updated {selectedPolicy.updated} · {selectedPolicy.pages} pages
                  </div>
                </div>
                <button className="og-btn-ghost">
                  <i className="fas fa-download" /> Download PDF
                </button>
              </div>

              <div className="og-policy-preview-area">
                {selectedPolicy.sections ? (
                  selectedPolicy.sections.map(section => (
                    <div key={section.id} className="og-policy-section">
                      {section.type === 'dos' && (
                        <>
                          <div className="og-policy-section-heading og-policy-dos-heading">
                            <i className="fas fa-check-circle" /> {section.heading}
                          </div>
                          <ul className="og-policy-item-list">
                            {section.items.map((item, i) => (
                              <li key={i} className="og-policy-dos-item">
                                <i className="fas fa-check" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {section.type === 'donts' && (
                        <>
                          <div className="og-policy-section-heading og-policy-donts-heading">
                            <i className="fas fa-times-circle" /> {section.heading}
                          </div>
                          <ul className="og-policy-item-list">
                            {section.items.map((item, i) => (
                              <li key={i} className="og-policy-donts-item">
                                <i className="fas fa-times" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {section.type === 'list' && (
                        <>
                          <div className="og-policy-section-heading">{section.heading}</div>
                          <ul className="og-policy-bullet-list">
                            {section.items.map((item, i) => <li key={i}>{item}</li>)}
                          </ul>
                        </>
                      )}
                      {!section.type && (
                        <>
                          <div className="og-policy-section-heading">{section.heading}</div>
                          <p className="og-policy-preview-text">{section.body}</p>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <>
                    <div className="og-policy-preview-title">{selectedPolicy.title}</div>
                    <p className="og-policy-preview-text">{selectedPolicy.description}</p>
                  </>
                )}
              </div>

              {!selectedPolicy.signed ? (
                <div className="og-policy-sign-section">
                  <label className="og-policy-checkbox-row">
                    <input type="checkbox" id={`agree-${selectedPolicy.id}`} />
                    <span>I have read and agree to the <strong>{selectedPolicy.title}</strong>.</span>
                  </label>

                  <div className="og-policy-signature-box">
                    <div className="og-policy-sig-label">
                      <i className="fas fa-pen-nib" style={{ marginRight: 6 }} />
                      Digital signature
                    </div>
                    <input
                      type="text"
                      className="og-profile-input"
                      value={signerName}
                      onChange={e => setSignerName(e.target.value)}
                      style={{ marginTop: 8 }}
                    />
                    <div className="og-policy-sig-meta">
                      Signed on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · IP 10.0.4.122
                    </div>
                  </div>

                  <button className="og-btn-primary" onClick={handleSign}>
                    Sign &amp; continue
                    <i className="fas fa-arrow-right" />
                  </button>
                </div>
              ) : (
                <div className="og-policy-signed-banner">
                  <i className="fas fa-check-circle" />
                  Signed on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="og-step-footer" style={{ justifyContent: 'flex-end' }}>
        <button className="og-btn-primary" onClick={onNext}>
          Continue <i className="fas fa-arrow-right" />
        </button>
      </div>
    </div>
  );
};

export default PolicyStep;
