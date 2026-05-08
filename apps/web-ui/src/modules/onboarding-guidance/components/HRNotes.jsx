import React from 'react';
import { HR_NOTES } from '../constants/onboardingData';
import { formatDate } from '../utils/formatDate';

const HRNotes = () => {
  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-comment-alt" />
          HR &amp; Team Notes
        </span>
        <span className="og-section-label">{HR_NOTES.length} NOTES</span>
      </div>

      <div className="og-notes-list">
        {HR_NOTES.map((note) => (
          <div
            key={note.id}
            className={`og-note-item ${note.pinned ? 'pinned' : ''}`}
          >
            <div
              className="og-note-avatar"
              style={{
                background: `${note.color}22`,
                color: note.color,
              }}
            >
              <i className={`fas ${note.authorIcon}`} />
            </div>

            <div className="og-note-body">
              <div className="og-note-header">
                <span className="og-note-author">{note.author}</span>
                {note.pinned && (
                  <span className="og-note-pin">
                    <i className="fas fa-thumbtack" />
                    Pinned
                  </span>
                )}
                <span className="og-note-time">{formatDate(note.timestamp)}</span>
              </div>
              <p className="og-note-message">{note.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HRNotes;
