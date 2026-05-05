import React, { useState } from 'react';
import { parseMarkdown } from '../utils/markdown';

// Single chat message — user bubble (right) or assistant bubble (left).
// Assistant bubbles include thumbs-up / thumbs-down feedback that toggles colour on click.
const MessageBubble = ({ message, config }) => {
  const [feedback, setFeedback] = useState(null); // null | 'up' | 'down'

  const isUser = message.role === 'user';

  // Toggle: click same button again to clear feedback
  const handleFeedback = (type) => setFeedback((prev) => (prev === type ? null : type));

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
            />
          )}
        </div>

        {/* Timestamp + feedback row */}
        <div className="message-meta">
          <span className="timestamp">{message.timestamp}</span>

          {!isUser && (
            <div className="feedback-buttons" role="group" aria-label="Message feedback">
              <button
                className={`feedback-btn${feedback === 'up' ? ' active-up' : ''}`}
                onClick={() => handleFeedback('up')}
                title="Helpful"
                aria-pressed={feedback === 'up'}
                aria-label="Mark as helpful"
              >
                <i className="fas fa-thumbs-up" />
              </button>
              <button
                className={`feedback-btn${feedback === 'down' ? ' active-down' : ''}`}
                onClick={() => handleFeedback('down')}
                title="Not helpful"
                aria-pressed={feedback === 'down'}
                aria-label="Mark as not helpful"
              >
                <i className="fas fa-thumbs-down" />
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
          {config.user.initials}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
