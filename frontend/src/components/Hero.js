import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

function PreviewRow({ name, status, priority, time, fail }) {
  return (
    <div className="preview-row">
      <span className="row-name">{name}</span>
      <span className={`badge ${fail ? 'bad' : 'good'}`}>{status}</span>
      <span className={`badge priority ${priority.toLowerCase()}`}>{priority}</span>
      <span className="row-time">{time}</span>
    </div>
  );
}

export default function Hero({ onLaunch, onDemo }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
    const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
    setPos({ x, y });
  };

  return (
    <section className="hero" ref={ref} onMouseMove={handleMove}>
      <div className="hero-bg">
        <div className="orb orb-1" style={{ transform: `translate3d(${pos.x * 40}px, ${pos.y * 40}px, 0)` }} />
        <div className="orb orb-2" style={{ transform: `translate3d(${pos.x * -60}px, ${pos.y * -60}px, 0)` }} />
        <div className="orb orb-3" style={{ transform: `translate3d(${pos.x * 30}px, ${pos.y * -30}px, 0)` }} />
        <div className="grid-bg" />
      </div>

      <motion.div
        className="hero-content"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="hero-badge">
          <span className="pulse-dot" /> AI-powered · ML scored · Production ready
        </div>
        <h1 className="hero-title">
          <span className="gradient-text">Intelligent API Testing</span><br />
          at Machine Speed
        </h1>
        <p className="hero-sub">
          Upload an OpenAPI spec. Get thousands of prioritized tests,
          ML-scored risk per endpoint, and anomaly detection — in seconds.
        </p>
        <div className="hero-cta">
          <button className="btn-primary" onClick={onLaunch} id="hero-launch-btn">
            Start Testing Free →
          </button>
          <button className="btn-ghost" onClick={onDemo} id="hero-demo-btn">
            ▶ Watch Demo
          </button>
        </div>

        <div
          className="hero-preview"
          style={{
            transform: `perspective(1400px) rotateX(${10 - pos.y * 6}deg) rotateY(${pos.x * 6}deg)`,
          }}
        >
          <div className="preview-glow" />
          <div className="preview-card glass">
            <div className="preview-header">
              <div className="dot red" /><div className="dot yellow" /><div className="dot green" />
              <span>nexus-ai · test-runner</span>
            </div>
            <div className="preview-body">
              <PreviewRow name="GET /users/:id"     status="PASS" priority="HIGH"     time="142ms" />
              <PreviewRow name="POST /payments"     status="PASS" priority="CRITICAL" time="298ms" />
              <PreviewRow name="DELETE /users/:id"  status="FAIL" priority="CRITICAL" time="89ms"  fail />
              <PreviewRow name="GET /products"      status="PASS" priority="MEDIUM"   time="67ms"  />
              <PreviewRow name="POST /auth/login"   status="PASS" priority="CRITICAL" time="188ms" />
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
