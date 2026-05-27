import React, { useState } from 'react';
import { INDUCTION_MODULES } from '../../constants/onboardingData';

// Default to public/ files if environment variables are not provided
const OFFICE_TOUR_URL = import.meta.env.VITE_OFFICE_TOUR_VIDEO_URL || '/Pune_Office_Tour_Aligned_Automation.mp4';
const CULTURE_URL     = import.meta.env.VITE_CULTURE_VIDEO_URL     || '/Pune_Culture_Video_Aligned_Automation.mp4.mp4';

const TABS = [
  { id: 'induction',   label: 'Induction Videos', icon: 'fa-play-circle' },
  { id: 'office-tour', label: 'Office Tour',       icon: 'fa-building'    },
  { id: 'culture',     label: 'Our Culture',       icon: 'fa-heart'       },
];

const OFFICE_TOUR_HIGHLIGHTS = [
  { icon: 'fa-door-open',      label: 'Reception & lobby' },
  { icon: 'fa-laptop',         label: 'Open-plan workspace' },
  { icon: 'fa-comments',       label: 'Meeting rooms & breakout zones' },
  { icon: 'fa-coffee',         label: 'Kitchen & wellness room' },
  { icon: 'fa-shield-alt',     label: 'Security & access points' },
];

const CULTURE_HIGHLIGHTS = [
  { icon: 'fa-star',           label: 'Our core values' },
  { icon: 'fa-users',          label: 'How we collaborate' },
  { icon: 'fa-lightbulb',      label: 'Innovation & ownership' },
  { icon: 'fa-balance-scale',  label: 'Work–life balance' },
  { icon: 'fa-chart-line',     label: 'Growth & learning mindset' },
];

const InductionStep = ({ onNext }) => {
  const [activeTab, setActiveTab]       = useState('induction');
  const [activeId, setActiveId]         = useState(1);
  const [modules, setModules]           = useState(INDUCTION_MODULES);
  const [playing, setPlaying]           = useState(false);
  const [tourWatched, setTourWatched]   = useState(false);
  const [cultureWatched, setCultureWatched] = useState(false);

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
    
      {/* Tabs */}
      <div className="og-induction-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`og-induction-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Induction Videos tab */}
      {activeTab === 'induction' && (
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
      )}

      {/* Office Tour tab */}
      {activeTab === 'office-tour' && (
        <div className="og-induction-layout">
          <div>
            <div className="og-video-player">
              <div className="og-video-label">Office Tour</div>
              {OFFICE_TOUR_URL ? (
                <iframe
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  src={OFFICE_TOUR_URL}
                  title="Office Tour"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <>
                  <i className="fas fa-building" style={{ fontSize: 48, color: 'rgba(255,255,255,0.18)', position: 'relative', zIndex: 1 }} />
                  <div className="og-video-overlay-bottom">
                    <span className="og-video-name">Set VITE_OFFICE_TOUR_VIDEO_URL to enable this video</span>
                  </div>
                </>
              )}
            </div>
            <div className="og-induction-actions">
              <button
                className="og-btn-primary"
                onClick={() => setTourWatched(true)}
                disabled={tourWatched}
              >
                <i className={`fas ${tourWatched ? 'fa-check-circle' : 'fa-check'}`} />
                {tourWatched ? 'Watched' : 'Mark as watched'}
              </button>
            </div>
          </div>

          <div className="og-playlist-panel">
            <div className="og-playlist-header">
              <span className="og-playlist-title">What you'll see</span>
              <span className="og-playlist-count">{OFFICE_TOUR_HIGHLIGHTS.length} sections</span>
            </div>
            <div className="og-playlist-list">
              {OFFICE_TOUR_HIGHLIGHTS.map((item, i) => (
                <div key={i} className="og-playlist-item">
                  <div className="og-playlist-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="og-playlist-item-text">
                    <div className="og-playlist-item-title">
                      <i className={`fas ${item.icon}`} style={{ marginRight: 6, opacity: 0.55 }} />
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Our Culture tab */}
      {activeTab === 'culture' && (
        <div className="og-induction-layout">
          <div>
            <div className="og-video-player">
              <div className="og-video-label">Our Culture</div>
              {CULTURE_URL ? (
                <iframe
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  src={CULTURE_URL}
                  title="Our Culture"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <>
                  <i className="fas fa-heart" style={{ fontSize: 48, color: 'rgba(255,255,255,0.18)', position: 'relative', zIndex: 1 }} />
                  <div className="og-video-overlay-bottom">
                    <span className="og-video-name">Set VITE_CULTURE_VIDEO_URL to enable this video</span>
                  </div>
                </>
              )}
            </div>
            <div className="og-induction-actions">
              <button
                className="og-btn-primary"
                onClick={() => setCultureWatched(true)}
                disabled={cultureWatched}
              >
                <i className={`fas ${cultureWatched ? 'fa-check-circle' : 'fa-check'}`} />
                {cultureWatched ? 'Watched' : 'Mark as watched'}
              </button>
            </div>
          </div>

          <div className="og-playlist-panel">
            <div className="og-playlist-header">
              <span className="og-playlist-title">What we cover</span>
              <span className="og-playlist-count">{CULTURE_HIGHLIGHTS.length} topics</span>
            </div>
            <div className="og-playlist-list">
              {CULTURE_HIGHLIGHTS.map((item, i) => (
                <div key={i} className="og-playlist-item">
                  <div className="og-playlist-num">{String(i + 1).padStart(2, '0')}</div>
                  <div className="og-playlist-item-text">
                    <div className="og-playlist-item-title">
                      <i className={`fas ${item.icon}`} style={{ marginRight: 6, opacity: 0.55 }} />
                      {item.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="og-step-footer" style={{ justifyContent: 'flex-end' }}>
        <button className="og-btn-primary" onClick={onNext}>
          Continue <i className="fas fa-arrow-right" />
        </button>
      </div>
    </div>
  );
};

export default InductionStep;
