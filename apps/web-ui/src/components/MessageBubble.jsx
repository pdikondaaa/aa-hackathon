import React, { useState } from 'react';
import { parseMarkdown } from '../utils/markdown';
import { submitFeedback, deleteFeedback } from '../services/api';
import { sendEmailViaGraph } from '../utils/authService';
import { isDocumentMessage, downloadDocument, printDocument } from '../utils/documentDownload';

const EmailDraftCard = ({ draft }) => {
  const [to, setTo]           = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody]       = useState(draft.body);
  const [status, setStatus]   = useState('idle'); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      await sendEmailViaGraph(to.trim(), subject.trim(), body.trim());
      setStatus('sent');
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to send email. Please try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  return (
    <div className="email-draft-card">
      <div className="email-draft-header">
        <i className="fas fa-envelope-open-text" />
        <span>Email Draft</span>
        <span className="email-draft-badge">AI Generated</span>
      </div>

      <div className="email-draft-fields">
        <div className="email-draft-field">
          <label className="email-draft-label">To</label>
          <input
            className="email-draft-input"
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com"
            disabled={status === 'sent'}
          />
        </div>
        <div className="email-draft-field">
          <label className="email-draft-label">Subject</label>
          <input
            className="email-draft-input"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            disabled={status === 'sent'}
          />
        </div>
        <div className="email-draft-field">
          <label className="email-draft-label">Body</label>
          <textarea
            className="email-draft-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
            disabled={status === 'sent'}
          />
        </div>
      </div>

      {status === 'error' && (
        <div className="email-draft-error">{errorMsg}</div>
      )}

      <button
        className={`email-draft-send-btn${status === 'sent' ? ' launched' : ''}`}
        onClick={handleSend}
        disabled={!to.trim() || !subject.trim() || status === 'sending' || status === 'sent'}
      >
        {status === 'sending' ? (
          <><i className="fas fa-spinner fa-spin" /> Sending...</>
        ) : status === 'sent' ? (
          <><i className="fas fa-check" /> Email Sent</>
        ) : (
          <><i className="fas fa-paper-plane" /> Send Email</>
        )}
      </button>
    </div>
  );
};

// Single chat message — user bubble (right) or assistant bubble (left).
// Assistant bubbles include thumbs-up / thumbs-down feedback that toggles colour on click.
const getInitials = (name = '') =>
  name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

const FeedbackModal = ({ onSubmit, onClose }) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(comment.trim());
    setSubmitting(false);
  };

  const handleOverlayKey = (e) => { if (e.key === 'Escape') onClose(); };

  return (
    <div
      className="feedback-modal-overlay"
      onClick={onClose}
      onKeyDown={handleOverlayKey}
      role="dialog"
      aria-modal="true"
      aria-label="Feedback"
    >
      <div className="feedback-modal" onClick={e => e.stopPropagation()}>
        <button className="feedback-modal-close" onClick={onClose} aria-label="Close">
          <i className="fas fa-times" />
        </button>
        <div className="feedback-modal-icon">
          <i className="fas fa-thumbs-down" />
        </div>
        <h3 className="feedback-modal-title">Help us improve</h3>
        <p className="feedback-modal-subtitle">
          Our model will train from your valuable feedback. Thank you for helping us get better!
        </p>
        <textarea
          className="feedback-modal-textarea"
          placeholder="Tell us what went wrong (optional)…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          autoFocus
        />
        <div className="feedback-modal-actions">
          <button className="feedback-modal-cancel" onClick={onClose}>Cancel</button>
          <button
            className="feedback-modal-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <><i className="fas fa-spinner fa-spin" /> Submitting…</> : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = ({ message, config, user, conversationId, onOpenEscalation, onOpenParkingDrawer }) => {
  const [feedback, setFeedback] = useState(message.initialFeedback?.rating ?? null);
  const [feedbackId, setFeedbackId] = useState(message.initialFeedback?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded]   = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const isUser     = message.role === 'user';
  const isDocument = !isUser && isDocumentMessage(message.content);

  const handleFeedback = async (type, comment) => {
    if (submitting || !message.backendId) return;
    setSubmitting(true);
    try {
      if (feedback === type && !comment) {
        // Same button clicked again — toggle off
        if (feedbackId) await deleteFeedback(feedbackId);
        setFeedback(null);
        setFeedbackId(null);
      } else {
        // New vote or change vote — upsert, forwarding optional comment
        const result = await submitFeedback(message.backendId, type, null, comment || null);
        setFeedback(type);
        setFeedbackId(result.id);
      }
    } catch (e) {
      console.error('Feedback failed:', e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    // Strip HTML tags to get plain text
    const plain = message.content.replace(/<[^>]+>/g, '');
    navigator.clipboard.writeText(plain).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadDocument(message.content);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    printDocument(message.content);
  };

  return (
    <div className={`message-wrap${isUser ? ' user' : ' assistant'}`}>

      {/* Avatar — assistant side */}
      {!isUser && (
        <div className="avatar assistant-avatar" aria-hidden="true">A</div>
      )}

      <div className={`message-body${message.emailDraft ? ' message-body--wide' : ''}`}>
        {/* Email draft card — replaces the standard bubble */}
        {message.emailDraft ? (
          <EmailDraftCard draft={message.emailDraft} />
        ) : (
        /* Standard bubble */
        <div className={`bubble${isUser ? ' bubble-user' : ' bubble-assistant'}`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div
              className="message-content"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
              onClick={(e) => {
                const anchor = e.target.closest('a');
                if (!anchor) return;
                const href = anchor.getAttribute('href');
                if (href === '#escalation') {
                  e.preventDefault();
                  onOpenEscalation?.({
                    conversationId: conversationId ?? message.conversationId ?? null,
                    messageId: message.backendId ?? null,
                  });
                } else if (href === '#parking-status') {
                  e.preventDefault();
                  onOpenParkingDrawer?.();
                }
              }}
            />
          )}
        </div>
        )}

        {/* Source citations */}
        {!isUser && !message.emailDraft && message.sources && message.sources.length > 0 && (
          <div className="sources-section">
            <div className="sources-header">
              <i className="fas fa-database" /> Sources ({message.sources.length})
            </div>
            <div className="sources-list">
              {message.sources.map((src) => (
                <div key={src.index} className="source-item">
                  <span className="source-index">{src.index}</span>
                  {src.source_url ? (
                    <a
                      className="source-link"
                      href={src.source_url}
                      target="_blank"
                      rel="noreferrer"
                      title={src.file_name}
                    >
                      {src.file_name}
                    </a>
                  ) : (
                    <span className="source-name">{src.file_name}</span>
                  )}
                  <span className="source-relevance">{src.similarity}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timestamp + feedback row */}
        <div className="message-meta">
          <span className="timestamp">{message.timestamp}</span>

          {!isUser && message.backendId && (
            <div className="feedback-buttons" role="group" aria-label="Message feedback">
              <button
                className={`feedback-btn${feedback === 'up' ? ' active-up' : ''}`}
                onClick={() => handleFeedback('up')}
                disabled={submitting}
                title="Helpful"
                aria-pressed={feedback === 'up'}
                aria-label="Mark as helpful"
              >
                <i className={`fas fa-thumbs-up${submitting ? ' fa-spin' : ''}`} />
              </button>
              <button
                className={`feedback-btn${feedback === 'down' ? ' active-down' : ''}`}
                onClick={() => feedback === 'down' ? handleFeedback('down') : setShowFeedbackModal(true)}
                disabled={submitting}
                title="Not helpful"
                aria-pressed={feedback === 'down'}
                aria-label="Mark as not helpful"
              >
                <i className={`fas fa-thumbs-down${submitting ? ' fa-spin' : ''}`} />
              </button>
              <button
                className={`feedback-btn${copied ? ' active-copy' : ''}`}
                onClick={handleCopy}
                title={copied ? 'Copied!' : 'Copy response'}
                aria-label="Copy response"
              >
                <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
              </button>

              {/* Document download & print — only shown for generated documents */}
              {isDocument && (
                <>
                  <span className="doc-actions-divider" aria-hidden="true" />
                  <button
                    className={`feedback-btn doc-action-btn${downloaded ? ' active-download' : ''}`}
                    onClick={handleDownload}
                    disabled={downloading}
                    title={downloading ? 'Generating PDF…' : downloaded ? 'Downloaded!' : 'Download PDF'}
                    aria-label="Download document as PDF"
                  >
                    <i className={`fas ${downloading ? 'fa-spinner fa-spin' : downloaded ? 'fa-check' : 'fa-download'}`} />
                  </button>
                  <button
                    className="feedback-btn doc-action-btn"
                    onClick={handlePrint}
                    title="Print / Save as PDF"
                    aria-label="Print document"
                  >
                    <i className="fas fa-print" />
                  </button>
                </>
              )}

              {feedback && (
                <span className="feedback-thanks" role="status">
                  {config.labels.feedbackThanks}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Avatar — user side */}
      {isUser && (
        <div className="avatar user-avatar" aria-hidden="true">
          {getInitials(user?.name) || config.user?.initials}
        </div>
      )}

      {showFeedbackModal && (
        <FeedbackModal
          onSubmit={async (comment) => {
            await handleFeedback('down', comment);
            setShowFeedbackModal(false);
          }}
          onClose={() => setShowFeedbackModal(false)}
        />
      )}
    </div>
  );
};

export default MessageBubble;
