import React, { useState, useRef, useCallback } from 'react';
import floorPlanImg from '../assets/aa-T2-10th.png';

export default function FloorPlanPage() {
  const [zoom, setZoom] = useState(1);
  const viewRef = useRef(null);
  const dragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0, sl: 0, st: 0 });

  const onMouseDown = useCallback(e => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY, sl: viewRef.current.scrollLeft, st: viewRef.current.scrollTop };
    viewRef.current.style.cursor = 'grabbing';
    e.preventDefault();
  }, []);

  const onMouseMove = useCallback(e => {
    if (!dragging.current) return;
    viewRef.current.scrollLeft = dragOrigin.current.sl - (e.clientX - dragOrigin.current.x);
    viewRef.current.scrollTop = dragOrigin.current.st - (e.clientY - dragOrigin.current.y);
  }, []);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    if (viewRef.current) viewRef.current.style.cursor = 'grab';
  }, []);

  return (
    <div className="fp-page">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="fp-header">
        <div className="fp-title-group">
          <i className="fas fa-building fp-title-icon" />
          <div>
            <h2 className="fp-title">Office Floor Plan</h2>
            <p className="fp-subtitle">
              Aligned Automation &nbsp;·&nbsp; Fountainhead Tower 2 &nbsp;·&nbsp; 10th Floor
            </p>
          </div>
        </div>
        <div className="fp-controls">
          <button className="fp-btn" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))}>
            <i className="fas fa-minus" />
          </button>
          <span className="fp-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="fp-btn" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}>
            <i className="fas fa-plus" />
          </button>
          <button className="fp-btn fp-btn-text" onClick={() => setZoom(1)}>Reset</button>
        </div>
      </div>

      {/* ── Image viewer ────────────────────────────────────────────────── */}
      <div className="fp-body">
        <div
          className="fp-viewport"
          ref={viewRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <div className="fp-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
            <img
              src={floorPlanImg}
              alt="Aligned Automation 10th Floor — Floor Plan"
              className="fp-image"
              draggable={false}
            />
          </div>
        </div>
      </div>

    </div>
  );
}
