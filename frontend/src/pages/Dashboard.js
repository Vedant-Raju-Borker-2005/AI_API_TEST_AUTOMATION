import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import Toast       from '../components/Toast';
import StepBar     from '../components/StepBar';
import UploadZone  from '../components/UploadZone';
import ResultsView from '../components/ResultsView';

import '../styles/dashboard.css';

const API = 'http://localhost:5000/api';

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ onBack, theme, toggleTheme }) {
  const [endpoints,      setEndpoints]      = useState([]);
  const [excelTests,     setExcelTests]     = useState([]);
  const [tests,          setTests]          = useState([]);
  const [results,        setResults]        = useState(null);
  const [status,         setStatus]         = useState('idle');
  const [specName,       setSpecName]       = useState('');
  const [excelName,      setExcelName]      = useState('');
  const [environments,   setEnvironments]   = useState([]);
  const [selectedEnv,    setSelectedEnv]    = useState('');
  const [chaining,       setChaining]       = useState(false);
  const [errorMsg,       setErrorMsg]       = useState('');
  const [warnings,       setWarnings]       = useState([]);
  const [toast,          setToast]          = useState(null);
  const [specUploading,  setSpecUploading]  = useState(false);
  const [excelUploading, setExcelUploading] = useState(false);
  const [specDragOver,   setSpecDragOver]   = useState(false);
  const [excelDragOver,  setExcelDragOver]  = useState(false);
  const [showAllTests,   setShowAllTests]   = useState(false);
  const [report,         setReport]         = useState(null);
  const [reportStatus,   setReportStatus]   = useState('idle');

  // File input refs — avoids label-wrapping freeze on Windows/Chrome
  const specInputRef  = useRef(null);
  const excelInputRef = useRef(null);
  // AbortController refs for in-flight requests
  const specAbortRef  = useRef(null);
  const excelAbortRef = useRef(null);

  // Determine current UI step (0 = upload, 1 = generate, 2 = run/results)
  const uiStep = useMemo(() => {
    if (results) return 2;
    if (tests.length > 0) return 2;
    if (endpoints.length > 0 || excelTests.length > 0) return 1;
    return 0;
  }, [results, tests.length, endpoints.length, excelTests.length]);

  // Whether the "Generate" button should be enabled
  const canGenerate = (endpoints.length > 0 || excelTests.length > 0)
    && status !== 'generating'
    && status !== 'uploading'
    && !specUploading
    && !excelUploading;

  // Fetch environments on mount; cancel in-flight uploads on unmount
  useEffect(() => {
    fetch(`${API}/environments`)
      .then((r) => r.json())
      .then((d) => setEnvironments(d.environments || []))
      .catch(() => {});
    return () => {
      specAbortRef.current?.abort();
      excelAbortRef.current?.abort();
    };
  }, []);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // ── Spec upload ─────────────────────────────────────────────────────────────
  const processSpecFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['json', 'yaml', 'yml'].includes(ext)) {
      setErrorMsg('Invalid file type. Please upload a .json, .yaml, or .yml OpenAPI / Swagger spec.');
      return;
    }
    specAbortRef.current?.abort();
    specAbortRef.current = new AbortController();
    setSpecName(file.name);
    setSpecUploading(true);
    setStatus('uploading');
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('spec', file);
      const resp = await fetch(`${API}/upload`, {
        method: 'POST', body: fd,
        signal: specAbortRef.current.signal,
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrorMsg(data.error || 'Failed to parse OpenAPI spec.');
        setStatus('idle');
        return;
      }
      setEndpoints(data.endpoints || []);
      setStatus('spec-ready');
      showToast(`Parsed ${data.endpoints?.length || 0} endpoints from ${file.name}`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg('Network error uploading spec: ' + err.message);
        setStatus('idle');
      }
    } finally {
      setSpecUploading(false);
    }
  }, [showToast]);

  const handleUploadSpec = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    processSpecFile(file);
  };

  // ── Excel upload ─────────────────────────────────────────────────────────────
  const processExcelFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setErrorMsg('Invalid file type. Please upload an .xlsx, .xls, or .csv file.');
      return;
    }
    excelAbortRef.current?.abort();
    excelAbortRef.current = new AbortController();
    setExcelName(file.name);
    setErrorMsg('');
    setWarnings([]);
    setExcelUploading(true);
    try {
      const fd = new FormData();
      fd.append('excel', file);
      const resp = await fetch(`${API}/upload-excel`, {
        method: 'POST', body: fd,
        signal: excelAbortRef.current.signal,
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrorMsg(data.error || 'Failed to parse Excel file.');
        return;
      }
      setExcelTests(data.tests || []);
      if (data.warnings?.length > 0) setWarnings(data.warnings);
      showToast(
        `Loaded ${data.tests?.length || 0} test case${data.tests?.length !== 1 ? 's' : ''} from ${file.name}`,
        data.warnings?.length > 0 ? 'warning' : 'success',
      );
    } catch (err) {
      if (err.name !== 'AbortError') {
        setErrorMsg('Network error uploading Excel: ' + err.message);
      }
    } finally {
      setExcelUploading(false);
    }
  }, [showToast]);

  const handleUploadExcel = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    processExcelFile(file);
  };

  // ── Generate tests ──────────────────────────────────────────────────────────
  const generateTests = async () => {
    setStatus('generating');
    setErrorMsg('');
    setTests([]);
    setResults(null);
    setShowAllTests(false);
    try {
      const resp = await fetch(`${API}/generate-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoints, excelTests }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrorMsg(data.error || 'Failed to generate tests.');
        setStatus(endpoints.length ? 'spec-ready' : 'idle');
        return;
      }
      setTests(data.tests || []);
      setStatus('ready');
      showToast(
        `Generated ${data.count} tests` +
        (data.stats?.fromExcel ? ` (${data.stats.fromExcel} from Excel, ${data.stats.generated} from spec)` : ''),
      );
    } catch (err) {
      setErrorMsg('Network error generating tests: ' + err.message);
      setStatus(endpoints.length ? 'spec-ready' : 'idle');
    }
  };

  // ── Run tests ───────────────────────────────────────────────────────────────
  const runTests = async () => {
    setStatus('running');
    setErrorMsg('');
    try {
      const resp = await fetch(`${API}/run-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tests, concurrency: 5, environment: selectedEnv || null, chaining }),
      });
      const data = await resp.json();
      if (!resp.ok || data.error) {
        setErrorMsg(data.error || 'Failed to run tests.');
        setStatus('ready');
        return;
      }
      setResults(data);
      setStatus('done');
    } catch (err) {
      setErrorMsg('Network error running tests: ' + err.message);
      setStatus('ready');
    }
  };

  const resetAll = () => {
    setEndpoints([]); setExcelTests([]); setTests([]); setResults(null);
    setStatus('idle'); setSpecName(''); setExcelName('');
    setErrorMsg(''); setWarnings([]); setShowAllTests(false);
    setReport(null); setReportStatus('idle');
  };

  const visibleTests = showAllTests ? tests : tests.slice(0, 10);

  const statusLabel = {
    idle: 'IDLE', uploading: 'UPLOADING', 'spec-ready': 'SPEC READY',
    generating: 'GENERATING', ready: 'READY', running: 'RUNNING', done: 'DONE',
  }[status] || status.toUpperCase();

  return (
    <div className="dashboard">
      {/* ── Nav ── */}
      <header className="dash-nav">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div className="dash-logo"><div className="logo-mark" /> NexusAI Dashboard</div>
        <div className="dash-nav-right">
          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <span className={`status-chip ${status}`}>{statusLabel}</span>
          {(tests.length > 0 || results) && (
            <button className="btn-ghost reset-btn" onClick={resetAll} title="Start over">↺ Reset</button>
          )}
        </div>
      </header>

      <div className="dash-body">
        {/* ── Step progress ── */}
        <StepBar step={uiStep} />

        {/* ── Hidden file inputs (ref-based — no label freeze) ── */}
        <input ref={specInputRef}  type="file" accept=".json,.yaml,.yml" onChange={handleUploadSpec}  style={{ display: 'none' }} id="spec-file-input" />
        <input ref={excelInputRef} type="file" accept=".xlsx,.xls,.csv"  onChange={handleUploadExcel} style={{ display: 'none' }} id="excel-file-input" />

        {/* ── Toasts ── */}
        <AnimatePresence>
          {toast && (
            <Toast
              key="toast"
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )}
        </AnimatePresence>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              className="error-banner"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <span>⚠️ {errorMsg}</span>
              <button onClick={() => setErrorMsg('')} className="toast-close">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Warnings banner ── */}
        {warnings.length > 0 && (
          <div className="warnings-banner">
            <strong>⚠️ Parse warnings ({warnings.length}):</strong>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}

        {/* ════════════════════════════════════════
            STEP 1 — Provide Inputs
        ════════════════════════════════════════ */}
        <motion.section
          className="dash-card glass"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="card-title">1. Provide Inputs</div>

          <div className="upload-grid">
            {/* OpenAPI Spec */}
            <div className="upload-container">
              <UploadZone
                inputRef={specInputRef}
                accept=".json"
                onChange={handleUploadSpec}
                onDrop={(e) => processSpecFile(e.dataTransfer.files[0])}
                dragOver={specDragOver}
                setDragOver={setSpecDragOver}
                uploading={specUploading}
                icon={endpoints.length > 0 ? '✅' : '📘'}
                title={specName || 'OpenAPI / Swagger Spec'}
                subtitle={
                  specUploading        ? 'Parsing spec…'
                  : endpoints.length > 0 ? `${endpoints.length} endpoints parsed`
                  : 'Click or drag & drop a .json / .yaml file'
                }
              />
              <a href={`${API}/samples/openapi`} className="sample-link" download>
                ↓ Download Sample Spec
              </a>
            </div>

            {/* Excel Test Cases */}
            <div className="upload-container">
              <UploadZone
                inputRef={excelInputRef}
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                onDrop={(e) => processExcelFile(e.dataTransfer.files[0])}
                dragOver={excelDragOver}
                setDragOver={setExcelDragOver}
                uploading={excelUploading}
                icon={excelTests.length > 0 ? '✅' : '📊'}
                title={excelName || 'Excel / CSV Test Cases'}
                subtitle={
                  excelUploading          ? 'Parsing file…'
                  : excelTests.length > 0 ? `${excelTests.length} test case${excelTests.length !== 1 ? 's' : ''} loaded`
                  : 'Click or drag & drop an .xlsx / .xls / .csv file'
                }
              />
              <a href={`${API}/samples/excel`} className="sample-link" download>
                ↓ Download Sample Excel
              </a>
            </div>
          </div>

          {/* ── Excel-only hint ── */}
          {excelTests.length > 0 && endpoints.length === 0 && (
            <motion.div
              className="excel-only-hint"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <span>💡</span>
              <div>
                <strong>Excel-only mode</strong> — Your {excelTests.length} test case{excelTests.length !== 1 ? 's' : ''} will
                run against the endpoints defined in your Excel file. Optionally upload an OpenAPI spec for
                richer test generation and endpoint matching.
              </div>
            </motion.div>
          )}

          {/* ── Generate button — unlocks on EITHER upload ── */}
          {(endpoints.length > 0 || excelTests.length > 0) && (
            <motion.div
              className="generate-row"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="generate-summary">
                {endpoints.length  > 0 && <span className="badge-pill spec">📘 {endpoints.length} endpoints</span>}
                {excelTests.length > 0 && <span className="badge-pill excel">📊 {excelTests.length} Excel tests</span>}
              </div>
              <button
                className="btn-primary"
                onClick={generateTests}
                disabled={!canGenerate}
                id="generate-btn"
              >
                {status === 'generating'
                  ? <><span className="spin">⟳</span> Generating…</>
                  : 'Generate Test Suite →'}
              </button>
            </motion.div>
          )}
        </motion.section>

        {/* ════════════════════════════════════════
            STEP 2 — Configure & Run
        ════════════════════════════════════════ */}
        <AnimatePresence>
          {tests.length > 0 && (
            <motion.section
              className="dash-card glass"
              key="step2"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              <div className="card-header">
                <div className="card-title">
                  2. Configure &amp; Run
                  <span className="test-count-badge">{tests.length} tests</span>
                </div>
                <button
                  className="btn-primary"
                  onClick={runTests}
                  disabled={status === 'running'}
                  id="run-tests-btn"
                >
                  {status === 'running'
                    ? <><span className="spin">⟳</span> Running…</>
                    : 'Run Tests →'}
                </button>
              </div>

              <div className="config-row">
                <div className="config-field">
                  <label>Environment</label>
                  <select value={selectedEnv} onChange={(e) => setSelectedEnv(e.target.value)}>
                    <option value="">— Use spec default —</option>
                    {environments.map((e) => (
                      <option key={e.name} value={e.name}>{e.name} ({e.baseUrl})</option>
                    ))}
                  </select>
                </div>
                <div className="config-field">
                  <label>Execution Mode</label>
                  <div className="toggle-row">
                    <button
                      className={`toggle-btn${!chaining ? ' active' : ''}`}
                      onClick={() => setChaining(false)}
                    >⚡ Concurrent</button>
                    <button
                      className={`toggle-btn${chaining ? ' active' : ''}`}
                      onClick={() => setChaining(true)}
                    >🔗 Chained</button>
                  </div>
                </div>
              </div>

              {/* Test preview list */}
              <div className="test-list">
                {visibleTests.map((t, i) => (
                  <div className="test-row" key={i}>
                    <span className={`method-pill ${t.method.toLowerCase()}`}>{t.method}</span>
                    <span className="test-path">{t.rawPath || t.endpoint}</span>
                    <span className={`badge priority ${(t.priority || '').toLowerCase()}`}>{t.priority}</span>
                    <span className={`badge risk-${(t.risk_label || '').toLowerCase()}`}>
                      Risk {t.risk_score?.toFixed(1)}
                    </span>
                    <span className="cat-pill">
                      {t.source === 'excel' ? '📊 Excel' : t.category}
                    </span>
                  </div>
                ))}
              </div>

              {tests.length > 10 && (
                <button
                  className="show-more-btn"
                  onClick={() => setShowAllTests((v) => !v)}
                >
                  {showAllTests ? '▲ Show less' : `▼ Show all ${tests.length} tests`}
                </button>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════
            STEP 3 — Results
        ════════════════════════════════════════ */}
        {results && (
          <ResultsView
            results={results}
            report={report}
            setReport={setReport}
            reportStatus={reportStatus}
            setReportStatus={setReportStatus}
            setErrorMsg={setErrorMsg}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}
