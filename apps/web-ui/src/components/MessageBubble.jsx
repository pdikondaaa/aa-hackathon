import React, { useState } from 'react';
import { parseMarkdown } from '../utils/markdown';
import { submitFeedback, deleteFeedback } from '../services/api';
import { isDocumentMessage, downloadDocument, printDocument } from '../utils/documentDownload';

const buildMailto = (to, subject, body) => {
  const params = [`subject=${encodeURIComponent(subject)}`, `body=${encodeURIComponent(body)}`];
  return `mailto:${encodeURIComponent(to)}?${params.join('&')}`;
};

const EmailDraftCard = ({ draft }) => {
  const [to, setTo]           = useState(draft.to);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody]       = useState(draft.body);
  const [launched, setLaunched] = useState(false);

  const handleSend = () => {
    window.location.href = buildMailto(to, subject, body);
    setLaunched(true);
    setTimeout(() => setLaunched(false), 3000);
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
          />
        </div>
        <div className="email-draft-field">
          <label className="email-draft-label">Subject</label>
          <input
            className="email-draft-input"
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </div>
        <div className="email-draft-field">
          <label className="email-draft-label">Body</label>
          <textarea
            className="email-draft-textarea"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={6}
          />
        </div>
      </div>

      <button
        className={`email-draft-send-btn${launched ? ' launched' : ''}`}
        onClick={handleSend}
        disabled={!to.trim() || !subject.trim()}
      >
        {launched ? (
          <><i className="fas fa-check" /> Outlook is opening...</>
        ) : (
          <><i className="fab fa-microsoft" /> Send Email</>
        )}
      </button>
    </div>
  );
};

// Single chat message — user bubble (right) or assistant bubble (left).
// Assistant bubbles include thumbs-up / thumbs-down feedback that toggles colour on click.
const getInitials = (name = '') =>
  name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

const MessageBubble = ({ message, config, user, conversationId, onOpenEscalation }) => {
  const [feedback, setFeedback] = useState(message.initialFeedback?.rating ?? null);
  const [feedbackId, setFeedbackId] = useState(message.initialFeedback?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded]   = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isUser     = message.role === 'user';
  const isDocument = !isUser && isDocumentMessage(message.content);

  const handleFeedback = async (type) => {
    if (submitting || !message.backendId) return;
    setSubmitting(true);
    try {
      if (feedback === type) {
        // Same button clicked again — toggle off
        if (feedbackId) await deleteFeedback(feedbackId);
        setFeedback(null);
        setFeedbackId(null);
      } else {
        // New vote or change vote — upsert
        const result = await submitFeedback(message.backendId, type);
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
                if (anchor && anchor.getAttribute('href') === '#escalation') {
                  e.preventDefault();
                  onOpenEscalation?.({
                    conversationId: conversationId ?? message.conversationId ?? null,
                    messageId: message.backendId ?? null,
                  });
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
                onClick={() => handleFeedback('down')}
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
    </div>
  );
};

export default MessageBubble;
