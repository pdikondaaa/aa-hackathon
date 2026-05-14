import React, { useState } from 'react';
import { parseMarkdown } from '../utils/markdown';
import { submitFeedback, deleteFeedback } from '../services/api';

// Single chat message — user bubble (right) or assistant bubble (left).
// Assistant bubbles include thumbs-up / thumbs-down feedback that toggles colour on click.
const MessageBubble = ({ message, config, conversationId, onOpenEscalation }) => {
  const [feedback, setFeedback] = useState(message.initialFeedback?.rating ?? null);
  const [feedbackId, setFeedbackId] = useState(message.initialFeedback?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';

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

  return (
    <div className={`message-wrap${isUser ? ' user' : ' assistant'}`}>

      {/* Avatar — assistant side */}
      {!isUser && (
        <div className="avatar assistant-avatar" aria-hidden="true">A</div>
      )}

      <div className="message-body">
        {/* Bubble */}
        <div className={`bubble${isUser ? ' bubble-user' : ' bubble-assistant'}`}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            /* Assistant messages support simple markdown */
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

        {/* Source citations */}
        {!isUser && message.sources && message.sources.length > 0 && (
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
          {config.user?.initials}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
