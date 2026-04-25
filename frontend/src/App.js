import React, { useState, useEffect } from 'react';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';

export default function App() {
  const [page, setPage] = useState('landing');
  const [theme, setTheme] = useState(() => localStorage.getItem('nexus_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexus_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return page === 'landing'
    ? <Landing onLaunch={() => setPage('dashboard')} theme={theme} toggleTheme={toggleTheme} />
    : <Dashboard onBack={() => setPage('landing')} theme={theme} toggleTheme={toggleTheme} />;
}
