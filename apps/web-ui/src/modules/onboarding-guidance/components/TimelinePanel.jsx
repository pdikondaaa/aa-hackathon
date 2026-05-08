import React from 'react';
import { TIMELINE_EVENTS } from '../constants/onboardingData';

const TimelinePanel = () => {
  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-stream" />
          Onboarding Journey
        </span>
        <span className="og-section-label">{TIMELINE_EVENTS.length} MILESTONES</span>
      </div>

      <div className="og-timeline-body">
        <div className="og-timeline-list">
          {TIMELINE_EVENTS.map((event, idx) => {
            const isLast = idx === TIMELINE_EVENTS.length - 1;
            return (
              <div key={event.id} className="og-timeline-item">
                <div className="og-timeline-left">
                  <div
                    className={`og-timeline-dot og-tl-${event.status}`}
                    style={{
                      background: event.status === 'upcoming'
                        ? 'var(--bg-elevated)'
                        : `${event.color}22`,
                      color: event.status === 'upcoming'
                        ? 'var(--text-muted)'
                        : event.color,
                      borderColor: event.status === 'upcoming'
                        ? 'var(--border)'
                        : event.color,
                    }}
                  >
                    <i className={`fas ${event.icon}`} />
                  </div>
                  {!isLast && (
                    <div
                      className="og-timeline-line"
                      style={{
                        background: event.status === 'done'
                          ? 'var(--primary)'
                          : 'var(--border)',
                      }}
                    />
                  )}
                </div>

                <div className="og-timeline-content">
                  <div className={`og-timeline-title og-tl-title-${event.status}`}>
                    {event.title}
                  </div>
                  <div className="og-timeline-date">
                    <i className="fas fa-calendar-alt" style={{ marginRight: 4, opacity: 0.5 }} />
                    {event.date}
                    {event.status === 'in-progress' && (
                      <span className="og-tl-active-pill">In Progress</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimelinePanel;
