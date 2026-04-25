import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

function FeatureCard({ icon, title, desc, index }) {
  const ref = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    setTilt({
      x: ((e.clientY - r.top) / r.height - 0.5) * -12,
      y: ((e.clientX - r.left) / r.width - 0.5) * 12,
    });
  };

  return (
    <motion.div
      ref={ref}
      className="feature-card glass"
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay: index * 0.08 }}
      style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="feature-glow" />
    </motion.div>
  );
}

const FEATURES = [
  { icon: '🧠', title: 'ML-Powered Prioritization',  desc: 'XGBoost scores every test so you run the riskiest ones first.' },
  { icon: '🎯', title: 'Smart Test Generation',       desc: 'Positive, negative, edge and security tests — generated automatically.' },
  { icon: '⚠️', title: 'Risk Scoring',               desc: 'Random Forest identifies fragile endpoints before they break production.' },
  { icon: '🔍', title: 'Anomaly Detection',           desc: 'Isolation Forest catches slow calls and unusual status patterns.' },
  { icon: '⚡', title: 'Concurrent Execution',        desc: 'Worker-pool runner executes hundreds of tests in parallel.' },
  { icon: '📊', title: 'Rich Analytics',              desc: 'Response times, pass rates, trends — beautifully visualized.' },
];

export default function Features() {
  return (
    <section id="features" className="features">
      <div className="section-header">
        <span className="section-kicker">Platform Capabilities</span>
        <h2 className="gradient-text">Everything you need.<br />Nothing you don't.</h2>
      </div>
      <div className="features-grid">
        {FEATURES.map((f, i) => (
          <FeatureCard key={i} {...f} index={i} />
        ))}
      </div>
    </section>
  );
}
