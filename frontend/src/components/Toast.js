import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

/**
 * Toast — auto-dismissing notification banner.
 * @param {string} message - Text to display
 * @param {'success'|'warning'} type  - Visual style
 * @param {Function} onDismiss - Called after 4 s or on × click
 */
export default function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const bg     = type === 'success' ? 'rgba(0,224,164,0.15)' : 'rgba(255,184,77,0.15)';
  const border = type === 'success' ? '#00e0a4' : '#ffb84d';
  const icon   = type === 'success' ? '✅' : '⚠️';

  return (
    <motion.div
      className="toast-banner"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      style={{ background: bg, border: `1px solid ${border}`, color: border }}
    >
      <span>{icon} {message}</span>
      <button onClick={onDismiss} className="toast-close">×</button>
    </motion.div>
  );
}
