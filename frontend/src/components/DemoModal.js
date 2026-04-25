import React, { useEffect, useRef } from 'react';

/**
 * DemoModal — full-screen modal video player for the platform demo.
 * Opens when the user clicks "Watch Demo" or the "Demo" nav link.
 */
export default function DemoModal({ open, onClose }) {
  const videoRef = useRef(null);

  // Play / pause when modal opens / closes
  useEffect(() => {
    if (!videoRef.current) return;
    if (open) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="demo-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Platform Demo Video"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="demo-modal glass">
        <div className="demo-modal-header">
          <div className="demo-modal-title">
            <div className="logo-mark" style={{ width: 20, height: 20 }} />
            <span>NexusAI — Platform Demo</span>
          </div>
          <button
            className="demo-close-btn"
            onClick={onClose}
            aria-label="Close demo"
          >
            ✕
          </button>
        </div>

        <div className="demo-video-wrapper">
          <video
            ref={videoRef}
            className="demo-video"
            src="/demo.mp4"
            controls
            playsInline
            preload="metadata"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="demo-modal-footer">
          <span>Press <kbd>Esc</kbd> or click outside to close</span>
          <button className="btn-primary" onClick={onClose}>
            Launch Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
