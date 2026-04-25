import React from 'react';

export default function Nav({ onLaunch, theme, toggleTheme, onDemo }) {
  return (
    <nav className="nav">
      <div className="nav-logo">
        <div className="logo-mark" />
        <span>Nexus<strong>AI</strong></span>
      </div>
      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a
          href="#demo"
          onClick={(e) => { e.preventDefault(); onDemo(); }}
        >
          Demo
        </a>
      </div>
      <div className="nav-actions">
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        <button className="btn-primary" onClick={onLaunch}>Launch Dashboard</button>
      </div>
    </nav>
  );
}
