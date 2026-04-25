import React, { useEffect, useState } from 'react';
import { useScroll, useTransform, motion } from 'framer-motion';

import Nav        from '../components/Nav';
import Hero       from '../components/Hero';
import Features   from '../components/Features';
import HowItWorks from '../components/HowItWorks';
import CTA        from '../components/CTA';
import DemoModal  from '../components/DemoModal';

import '../styles/landing.css';

export default function Landing({ onLaunch, theme, toggleTheme }) {
  const { scrollYProgress } = useScroll();
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -200]);

  // Demo video modal state
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo  = () => setDemoOpen(true);
  const closeDemo = () => setDemoOpen(false);

  useEffect(() => {
    // Smooth scroll for any remaining anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach((l) =>
      l.addEventListener('click', (e) => {
        e.preventDefault();
        const el = document.querySelector(l.getAttribute('href'));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }),
    );
  }, []);

  return (
    <div className="landing">
      <motion.div className="global-bg" style={{ y: bgY }} />

      <Nav
        onLaunch={onLaunch}
        theme={theme}
        toggleTheme={toggleTheme}
        onDemo={openDemo}
      />

      <Hero onLaunch={onLaunch} onDemo={openDemo} />
      <Features />
      <HowItWorks />
      <CTA onLaunch={onLaunch} />

      <footer className="footer">© 2025 NexusAI — Built with ❤️</footer>

      {/* ── Demo video modal ── */}
      <DemoModal open={demoOpen} onClose={closeDemo} />
    </div>
  );
}
