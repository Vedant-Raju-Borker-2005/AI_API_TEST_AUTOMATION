import React from 'react';

export default function CTA({ onLaunch }) {
  return (
    <section className="cta">
      <div className="cta-inner glass">
        <h2 className="gradient-text">Ship with confidence.</h2>
        <p>Let the machine find bugs while you ship features.</p>
        <button className="btn-primary" onClick={onLaunch} id="cta-launch-btn">
          Launch Dashboard →
        </button>
      </div>
    </section>
  );
}
