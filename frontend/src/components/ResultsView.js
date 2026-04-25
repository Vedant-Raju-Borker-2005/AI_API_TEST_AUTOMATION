import React, { memo, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const API = 'http://localhost:5000/api';

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <motion.div
      className="stat-card glass"
      whileHover={{ y: -4 }}
      style={{ borderTop: `2px solid ${color}` }}
    >
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </motion.div>
  );
}

// ─── Results view (memoised to prevent re-renders) ────────────────────────────
const ResultsView = memo(function ResultsView({
  results, report, setReport, reportStatus, setReportStatus, setErrorMsg, showToast,
}) {
  const { summary, results: rows } = results;
  const [showAll, setShowAll] = useState(false);

  // ── NLP report generation ────────────────────────────────────────────────
  const handleGenerateReport = async () => {
    setReportStatus('generating');
    try {
      const payload = { runId: results.runId, summary, results: rows };
      const res = await fetch(`${API}/report/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Failed to generate report');
      }
      setReport(data);
      showToast('NLP Report generated successfully! Click Download Report to save.');
    } catch (err) {
      setErrorMsg('Report Generation Error: ' + err.message);
    } finally {
      setReportStatus('idle');
    }
  };

  // ── Pure client-side TXT download ────────────────────────────────────────
  const handleDownloadTxt = () => {
    if (!report) return;

    const meta     = report.metadata || {};
    const ts       = report.generatedAt || new Date().toISOString();
    const rawRunId = report.runId || results?.runId || 'N/A';
    const runIdStr = String(rawRunId);
    const src      = report.summarySource || 'rule-based';

    const strip = (s) =>
      String(s || '')
        .replace(/\*\*/g, '')
        .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
        .replace(/[\u2600-\u27BF]/g, '')
        .replace(/\u200d/g, '')
        .replace(/\uFE0F/g, '')
        .replace(/\u2014/g, '-')
        .replace(/\u2013/g, '-')
        .trim();

    const lines = [
      '================================================================',
      '        NexusAI - API Test Execution Report',
      '================================================================',
      '',
      `  Run ID      : ${runIdStr}`,
      `  Generated   : ${ts}`,
      `  Environment : ${meta.environment || 'default'}`,
      `  Source      : ${src}`,
      '',
      '----------------------------------------------------------------',
      '  STATISTICS',
      '----------------------------------------------------------------',
      `  Total Tests       : ${meta.total     ?? 0}`,
      `  Passed            : ${meta.passed    ?? 0}`,
      `  Failed            : ${meta.failed    ?? 0}`,
      `  Pass Rate         : ${meta.passRate  ?? 0}%`,
      `  Anomalies         : ${meta.anomalies ?? 0}`,
      '',
      '----------------------------------------------------------------',
      '  EXECUTIVE SUMMARY',
      '----------------------------------------------------------------',
      `  ${strip(meta.executiveSummary) || 'No summary available.'}`,
      '',
      '----------------------------------------------------------------',
      '  RISK DISTRIBUTION',
      '----------------------------------------------------------------',
    ];

    const riskDist    = meta.riskDistribution || {};
    const riskEntries = Object.entries(riskDist);
    if (riskEntries.length > 0) {
      riskEntries.forEach(([lvl, cnt]) => {
        const bar = '#'.repeat(Math.min(cnt, 30));
        lines.push(`  ${lvl.padEnd(12)}: ${String(cnt).padStart(3)}  ${bar}`);
      });
    } else {
      lines.push('  No risk data available.');
    }

    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('  RECOMMENDATIONS');
    lines.push('----------------------------------------------------------------');

    const recs = meta.recommendations || [];
    if (recs.length > 0) {
      recs.forEach((r, i) => lines.push(`  ${i + 1}. ${strip(r)}`));
    } else {
      lines.push('  No specific recommendations.');
    }

    lines.push('');
    lines.push('----------------------------------------------------------------');
    lines.push('  DETAILED TEST RESULTS');
    lines.push('----------------------------------------------------------------');

    if (rows && rows.length > 0) {
      lines.push('');
      lines.push(
        '  ' +
        'Test Name'.padEnd(45) + 'Method'.padEnd(8) + 'Status'.padEnd(8) +
        'Priority'.padEnd(10) + 'Risk'.padEnd(6) + 'Time'.padEnd(8) + 'Anomaly',
      );
      lines.push('  ' + '-'.repeat(95));

      rows.forEach((r) => {
        const name     = String(r.testName || '').substring(0, 43).padEnd(45);
        const method   = String(r.method   || '').padEnd(8);
        const status   = String(r.status   || '').padEnd(8);
        const priority = String(r.priority || '').padEnd(10);
        const risk     = String(r.risk_score != null ? r.risk_score.toFixed(1) : '-').padEnd(6);
        const time     = String((r.responseTime || 0) + 'ms').padEnd(8);
        const anomaly  = r.anomaly ? 'YES' : '-';
        lines.push(`  ${name}${method}${status}${priority}${risk}${time}${anomaly}`);
      });

      lines.push('');
      lines.push(`  Total: ${rows.length} tests`);
    } else {
      lines.push('  No detailed results available.');
    }

    lines.push('');
    lines.push('================================================================');
    lines.push('  NexusAI v1.0.0  |  AI-Powered API Test Automation');
    lines.push('================================================================');
    lines.push('');

    const content = '\uFEFF' + lines.join('\r\n');
    const blob    = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url     = URL.createObjectURL(blob);
    const safeId  = runIdStr.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 8) || 'report';
    const a       = document.createElement('a');
    a.href        = url;
    a.setAttribute('download', `nexusai_report_${safeId}_${Date.now()}.txt`);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    showToast('Report downloaded successfully!');
  };

  // ── PDF download via backend ──────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!report) return;
    setReportStatus('generating-pdf');
    try {
      const res  = await fetch(`${API}/report/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      const data = await res.json();
      if (!res.ok || data.error || !data.success) {
        throw new Error(data.error || 'Failed to generate PDF');
      }
      const byteCharacters = atob(data.pdf_base64);
      const byteNumbers    = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob      = new Blob([byteArray], { type: 'application/pdf' });
      const url       = URL.createObjectURL(blob);
      const a         = document.createElement('a');
      a.href          = url;
      a.setAttribute('download', data.filename || `nexusai_report_${Date.now()}.pdf`);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
      showToast('PDF Report downloaded successfully!');
    } catch (err) {
      setErrorMsg('PDF Generation Error: ' + err.message);
    } finally {
      setReportStatus('idle');
    }
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const pieData = [
    { name: 'Passed', value: summary.passed },
    { name: 'Failed', value: summary.failed },
  ];
  const PIE_COLORS = ['#00e0a4', '#ff5c7c'];

  const rtData = useMemo(() =>
    rows.slice(0, 25).map((r) => ({
      name: r.method + ' ' + (r.endpoint || '').slice(0, 18),
      time: r.responseTime,
    })),
  [rows]);

  const visibleRows = showAll ? rows : rows.slice(0, 20);

  return (
    <>
      {/* ── Summary stat cards ── */}
      <motion.section className="summary-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <StatCard label="Total"       value={summary.total}                    color="#7c5cff" />
        <StatCard label="Pass Rate"   value={summary.passRate + '%'}           color="#00e0a4" />
        <StatCard label="Failed"      value={summary.failed}                   color="#ff5c7c" />
        <StatCard label="Avg Time"    value={summary.avgResponseTime + 'ms'}   color="#00d4ff" />
        <StatCard label="Anomalies"   value={summary.anomalies}                color="#ffb84d" />
        <StatCard label="Environment" value={summary.environment}              color="#a89cff" />
      </motion.section>

      {/* ── Charts ── */}
      <div className="charts-grid">
        <div className="dash-card glass">
          <div className="card-title">Pass / Fail</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={85}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#11131c', border: '1px solid #1f2230' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="dash-card glass">
          <div className="card-title">Response Times (ms)</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rtData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2230" />
              <XAxis dataKey="name" stroke="#9aa0b4" fontSize={10} />
              <YAxis stroke="#9aa0b4" fontSize={11} />
              <Tooltip contentStyle={{ background: '#11131c', border: '1px solid #1f2230' }} />
              <Bar dataKey="time" fill="#7c5cff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Detailed results table ── */}
      <section className="dash-card glass results-section">
        <div className="card-title">Detailed Results</div>
        <div className="results-table">
          <div className="tr th">
            <div>Test</div><div>Method</div><div>Status</div>
            <div>Priority</div><div>Risk</div><div>Time</div><div>Anomaly</div>
          </div>
          {visibleRows.map((r, i) => (
            <div className="tr" key={i}>
              <div className="test-name-cell">{r.testName}</div>
              <div><span className={`method-pill ${r.method.toLowerCase()}`}>{r.method}</span></div>
              <div><span className={`badge ${r.status === 'PASS' ? 'good' : 'bad'}`}>{r.status}</span></div>
              <div><span className={`badge priority ${(r.priority || '').toLowerCase()}`}>{r.priority}</span></div>
              <div>{r.risk_score?.toFixed(1)}</div>
              <div className="time-cell">{r.responseTime}ms</div>
              <div>{r.anomaly ? '⚠️' : '—'}</div>
            </div>
          ))}
        </div>
        {rows.length > 20 && (
          <button className="show-more-btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '▲ Show less' : `▼ Show all ${rows.length} results`}
          </button>
        )}
      </section>

      {/* ── NLP Report section ── */}
      <section className="dash-card glass report-section">
        <div className="card-header">
          <div className="card-title">NLP Execution Report</div>
          <div className="report-actions">
            {!report ? (
              <button
                className="btn-primary"
                onClick={handleGenerateReport}
                disabled={reportStatus !== 'idle'}
                id="generate-report-btn"
              >
                {reportStatus === 'generating'
                  ? <><span className="spin">⟳</span> Generating AI Report…</>
                  : '✨ Generate Report'}
              </button>
            ) : (
              <div className="report-download-group" style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn-primary"
                  onClick={handleDownloadPdf}
                  disabled={reportStatus !== 'idle'}
                  id="download-pdf-btn"
                >
                  {reportStatus === 'generating-pdf'
                    ? <><span className="spin">⟳</span> Generating PDF…</>
                    : '📄 Download PDF'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleDownloadTxt}
                  disabled={reportStatus !== 'idle'}
                  id="download-txt-btn"
                >
                  📥 Download .txt
                </button>
              </div>
            )}
          </div>
        </div>

        {report && report.metadata && (
          <div className="report-content">
            <div className="report-exec-summary">
              <h3>🤖 Executive Summary</h3>
              <p>{report.metadata.executiveSummary}</p>
              <div className="report-meta">
                Source: <span>{report.summarySource}</span>
              </div>
            </div>
            <div className="report-recommendations">
              <h3>💡 Recommendations</h3>
              <ul>
                {report.metadata.recommendations.map((rec, i) => (
                  <li key={i}>
                    {rec
                      .replace(/\*\*/g, '')
                      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
                      .trim()}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </>
  );
});

export default ResultsView;
