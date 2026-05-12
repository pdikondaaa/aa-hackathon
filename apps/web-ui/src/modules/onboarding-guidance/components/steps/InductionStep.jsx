import React, { useState } from 'react';
import { INDUCTION_MODULES } from '../../constants/onboardingData';

const InductionStep = () => {
  const [activeId, setActiveId]   = useState(1);
  const [modules, setModules]     = useState(INDUCTION_MODULES);
  const [playing, setPlaying]     = useState(false);

  const activeModule = modules.find(m => m.id === activeId);
  const watchedCount = modules.filter(m => m.status === 'completed').length;
  const totalTime    = modules.reduce((sum, m) => sum + parseInt(m.duration), 0);

  const handleMarkComplete = () => {
    setModules(prev => prev.map(m => {
      if (m.id === activeId) return { ...m, status: 'completed' };
      if (m.id === activeId + 1) return { ...m, status: 'in-progress' };
      return m;
    }));
    const next = modules.find(m => m.id > activeId && m.status !== 'completed');
    if (next) setActiveId(next.id);
  };

  return (
    <div className="og-step-content">
      <div className="og-step-header">
        <div className="og-step-header-top">
          <div>
            <h2 className="og-step-title">Induction &amp; orientation</h2>
            <p className="og-step-subtitle">
              Get to know Aligned Automation through a short video series.
            </p>
          </div>

          <div className="og-step-stat-group">
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Modules</div>
              <div className="og-step-stat-value">{watchedCount} / {modules.length}</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Total time</div>
              <div className="og-step-stat-value">{totalTime} min</div>
            </div>
            <div className="og-step-stat-divider" />
            <div className="og-step-stat-box">
              <div className="og-step-stat-label">Reward</div>
              <div className="og-step-stat-value">+1 badge</div>
            </div>
          </div>
        </div>
      </div>

      <div className="og-induction-layout">
        {/* Video player */}
        <div>
          <div className="og-video-player">
            <div className="og-video-label">Induction · Episode {activeId}</div>
            <button
              className={`og-video-play-btn ${playing ? 'playing' : ''}`}
              onClick={() => setPlaying(p => !p)}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              <i className={`fas ${playing ? 'fa-pause' : 'fa-play'}`} />
            </button>
            <div className="og-video-overlay-bottom">
              <button className="og-video-ctrl-btn">
                <i className="fas fa-play" />
              </button>
              <button className="og-video-ctrl-btn">
                <i className="fas fa-volume-up" />
              </button>
              <span className="og-video-name">{activeModule?.title}</span>
            </div>
          </div>

          <div className="og-induction-actions">
            <button className="og-btn-primary" onClick={handleMarkComplete}>
              <i className="fas fa-check" /> Mark complete &amp; continue
            </button>
          </div>
        </div>

        {/* Playlist */}
        <div className="og-playlist-panel">
          <div className="og-playlist-header">
            <span className="og-playlist-title">Induction playlist</span>
            <span className="og-playlist-count">{watchedCount} / {modules.length} watched</span>
          </div>

          <div className="og-playlist-list">
            {modules.map((m, idx) => (
              <div
                key={m.id}
                className={`og-playlist-item ${activeId === m.id ? 'active' : ''} ${m.status === 'completed' ? 'completed' : ''}`}
                onClick={() => setActiveId(m.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActiveId(m.id)}
              >
                <div className="og-playlist-num">
                  {m.status === 'completed'
                    ? <i className="fas fa-check-circle" style={{ color: 'var(--secondary)' }} />
                    : <span>{String(idx + 1).padStart(2, '0')}</span>
                  }
                </div>
                <div className="og-playlist-item-text">
                  <div className="og-playlist-item-title">{m.title}</div>
                  <div className="og-playlist-item-meta">{m.duration}</div>
                </div>
                <div className="og-playlist-item-status">
                  {m.status === 'in-progress' && (
                    <span className="og-tl-active-pill">In progress</span>
                  )}
                  {m.status === 'up-next' && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      <i className="fas fa-clock" /> Up next
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="og-required-listening">
            <div className="og-req-listen-title">
              <i className="fas fa-headphones" />
              Required listening
            </div>
            <p className="og-req-listen-body">
              A 90-second voice note from our CEO on what we expect — and what you can expect from us.
            </p>
            <div className="og-audio-player">
              <button className="og-audio-play-btn">
                <i className="fas fa-play" />
              </button>
              <div className="og-audio-info">
                <div className="og-audio-title">Voice note from CEO · 1:30</div>
                <div className="og-audio-waveform">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div key={i} className="og-audio-bar" style={{ height: `${4 + Math.random() * 14}px` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InductionStep;
