import React, { useState, useRef } from 'react';
import { refineEmail } from '../services/api';

const buildMailto = (to, cc, subject, body) => {
  const parts = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  if (cc) parts.unshift(`cc=${encodeURIComponent(cc)}`);
  return `mailto:${encodeURIComponent(to)}?${parts.join('&')}`;
};

const THINKING_MSGS = [
  'Reading your draft...',
  'Choosing the right tone...',
  'Polishing the language...',
  'Structuring your message...',
  'Almost done...',
];

const EmailAgentPage = ({ user }) => {
  const [to,      setTo]      = useState('');
  const [cc,      setCc]      = useState('');
  const [subject, setSubject] = useState('');
  const [body,    setBody]    = useState('');

  const [refined,    setRefined]    = useState(null);
  const [isRefining, setIsRefining] = useState(false);
  const [thinkIdx,   setThinkIdx]   = useState(0);
  const [error,      setError]      = useState('');
  const [copied,     setCopied]     = useState(false);
  const [launched,   setLaunched]   = useState(false);

  const thinkTimerRef = useRef(null);

  const startThinkingCycle = () => {
    setThinkIdx(0);
    thinkTimerRef.current = setInterval(() => {
      setThinkIdx(i => (i + 1) % THINKING_MSGS.length);
    }, 1800);
  };

  const stopThinkingCycle = () => {
    clearInterval(thinkTimerRef.current);
  };

  const handleRefine = async () => {
    if (!body.trim()) {
      setError('Please write your email message before refining.');
      return;
    }
    setError('');
    setIsRefining(true);
    startThinkingCycle();

    try {
      const res = await refineEmail({ to, cc, subject, body });
      setRefined({
        to,
        cc,
        subject: res.refined_subject || subject,
        body:    res.refined_body    || body,
      });
    } catch (err) {
      setError(err.message || 'Failed to refine email. Please try again.');
      console.error('[EmailAgent]', err);
    } finally {
      stopThinkingCycle();
      setIsRefining(false);
    }
  };

  const handleOpenOutlook = () => {
    window.location.href = buildMailto(refined.to, refined.cc, refined.subject, refined.body);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 3000);
  };

  const handleCopy = () => {
    if (!refined) return;
    const text = `To: ${refined.to}${refined.cc ? `\nCC: ${refined.cc}` : ''}\nSubject: ${refined.subject}\n\n${refined.body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setRefined(null);
    setError('');
  };

  return (
    <main className="main-content ea-page">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="ea-page-header">
        <div className="ea-page-header-icon">
          <i className="fas fa-envelope-open-text" />
        </div>
        <div className="ea-page-header-text">
          <h1 className="ea-page-title">Email Agent</h1>
          <p className="ea-page-subtitle">Draft your email, refine it with AI, then open directly in Outlook</p>
        </div>
        {refined && (
          <button className="ea-reset-btn" onClick={handleReset} title="Start over">
            <i className="fas fa-redo" /> New Email
          </button>
        )}
      </div>

      {/* ── Two-column layout ───────────────────────────── */}
      <div className="ea-layout">

        {/* ── LEFT: Draft ─────────────────────────────── */}
        <section className="ea-card ea-draft-card">
          <div className="ea-card-head">
            <i className="fas fa-pencil-alt" />
            <span>Your Draft</span>
          </div>

          <div className="ea-form">
            <div className="ea-field">
              <label className="ea-label">To <span className="ea-req">*</span></label>
              <input
                className="ea-input"
                type="email"
                placeholder="recipient@example.com"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>

            <div className="ea-field">
              <label className="ea-label">CC <span className="ea-opt">(optional)</span></label>
              <input
                className="ea-input"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={e => setCc(e.target.value)}
              />
            </div>

            <div className="ea-field">
              <label className="ea-label">Subject <span className="ea-req">*</span></label>
              <input
                className="ea-input"
                type="text"
                placeholder="What is this email about?"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            <div className="ea-field ea-field-body">
              <label className="ea-label">Message <span className="ea-req">*</span></label>
              <textarea
                className="ea-textarea"
                placeholder={`Write your email in rough — e.g.\n"hey john, just checking if you reviewed the report i sent last week, we need it before thursday meeting, also can you loop in sarah"`}
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="ea-error">
              <i className="fas fa-exclamation-circle" /> {error}
            </p>
          )}

          <button
            className="ea-primary-btn"
            onClick={handleRefine}
            disabled={isRefining || !body.trim()}
          >
            {isRefining ? (
              <>
                <i className="fas fa-spinner fa-spin" />
                <span>{THINKING_MSGS[thinkIdx]}</span>
              </>
            ) : (
              <>
                <i className="fas fa-magic" />
                <span>Refine with AI</span>
              </>
            )}
          </button>
        </section>

        {/* ── Connector ───────────────────────────────── */}
        <div className="ea-connector" aria-hidden="true">
          <div className={`ea-connector-line${isRefining ? ' ea-connector-line--active' : ''}`} />
          <div className={`ea-connector-arrow${isRefining ? ' ea-connector-arrow--spin' : ''}`}>
            <i className={`fas ${isRefining ? 'fa-spinner fa-spin' : 'fa-arrow-right'}`} />
          </div>
          <div className={`ea-connector-line${isRefining ? ' ea-connector-line--active' : ''}`} />
        </div>

        {/* ── RIGHT: Refined ──────────────────────────── */}
        <section className={`ea-card ea-refined-card${refined ? ' ea-refined-card--ready' : ''}`}>
          <div className="ea-card-head">
            <i className="fas fa-magic" style={{ color: 'var(--secondary)' }} />
            <span>Refined Email</span>
            {refined && (
              <button className="ea-icon-btn" onClick={handleCopy} title="Copy all">
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            )}
          </div>

          {!refined ? (
            <div className="ea-empty-state">
              <div className="ea-empty-icon">
                <i className="fas fa-envelope" />
              </div>
              <p className="ea-empty-title">Your polished email will appear here</p>
              <p className="ea-empty-hint">
                {isRefining
                  ? THINKING_MSGS[thinkIdx]
                  : 'Fill in your draft and click "Refine with AI"'}
              </p>
              {isRefining && (
                <div className="ea-refining-dots">
                  <span /><span /><span />
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="ea-form">
                <div className="ea-field">
                  <label className="ea-label">To</label>
                  <input
                    className="ea-input"
                    type="email"
                    value={refined.to}
                    onChange={e => setRefined(r => ({ ...r, to: e.target.value }))}
                  />
                </div>

                {refined.cc && (
                  <div className="ea-field">
                    <label className="ea-label">CC</label>
                    <input
                      className="ea-input"
                      type="email"
                      value={refined.cc}
                      onChange={e => setRefined(r => ({ ...r, cc: e.target.value }))}
                    />
                  </div>
                )}

                <div className="ea-field">
                  <label className="ea-label">Subject</label>
                  <input
                    className="ea-input"
                    type="text"
                    value={refined.subject}
                    onChange={e => setRefined(r => ({ ...r, subject: e.target.value }))}
                  />
                </div>

                <div className="ea-field ea-field-body">
                  <label className="ea-label">Body</label>
                  <textarea
                    className="ea-textarea"
                    value={refined.body}
                    onChange={e => setRefined(r => ({ ...r, body: e.target.value }))}
                  />
                </div>
              </div>

              <button className="ea-outlook-btn" onClick={handleOpenOutlook}>
                {launched ? (
                  <>
                    <i className="fas fa-check" />
                    <span>Outlook is opening...</span>
                  </>
                ) : (
                  <>
                    <i className="fab fa-microsoft" />
                    <span>Open in Outlook</span>
                  </>
                )}
              </button>
            </>
          )}
        </section>

      </div>
    </main>
  );
};

export default EmailAgentPage;
