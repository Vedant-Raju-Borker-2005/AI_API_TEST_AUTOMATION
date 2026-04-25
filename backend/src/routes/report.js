const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { db } = require('../db/database');

const router = express.Router();
const PYTHON = process.env.PYTHON_BIN || 'python';
const NLP_SCRIPT = path.resolve(__dirname, '../../../ml_scripts/training/nlp_report.py');
const PDF_SCRIPT = path.resolve(__dirname, '../../../ml_scripts/training/generate_pdf.py');

/**
 * Helper to call Python scripts via stdin/stdout
 */
function runPythonScript(scriptPath, inputData, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [scriptPath, ...extraArgs]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script ${path.basename(scriptPath)} exited with code ${code}. Error: ${stderr}`);
      }
      try {
        const jsonStart = stdout.indexOf('{');
        if (jsonStart === -1) throw new Error('No JSON object found in output');
        const jsonStr = stdout.substring(jsonStart);
        const parsed = JSON.parse(jsonStr);
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse Python output. Error: ${e.message}. Stderr: ${stderr}. Stdout: ${stdout.substring(0, 200)}...`));
      }
    });

    proc.on('error', (err) => reject(err));

    proc.stdin.write(JSON.stringify(inputData));
    proc.stdin.end();
  });
}

/**
 * POST /api/report/generate
 * Generates an NLP report from test results JSON
 */
router.post('/generate', async (req, res) => {
  try {
    const data = req.body;
    if (!data || !data.results) {
      return res.status(400).json({ error: 'Valid results object required' });
    }
    const report = await runPythonScript(NLP_SCRIPT, data, ['--use-model']);
    res.json(report);
  } catch (e) {
    console.error('NLP Report error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/report/:runId
 * Fetches a test run from DB and generates an NLP report
 */
router.get('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });

    const results = db.prepare('SELECT * FROM test_results WHERE run_id = ?').all(runId);
    
    let summaryObj = {};
    try {
      summaryObj = JSON.parse(run.summary || '{}');
    } catch (e) {}

    const payload = {
      runId: run.id,
      summary: {
        total: run.total,
        passed: run.passed,
        failed: run.failed,
        avgResponseTime: run.avg_response_time,
        environment: run.spec_name,
        passRate: summaryObj.passRate || ((run.passed / run.total) * 100).toFixed(1),
        failRate: (((run.total - run.passed) / run.total) * 100).toFixed(1),
        anomalies: results.filter(r => r.anomaly === 1).length,
        chaining: summaryObj.chaining || false
      },
      results: results.map(r => ({
        testName: r.test_name,
        endpoint: r.endpoint,
        method: r.method,
        category: r.category,
        status: r.status,
        statusCode: r.status_code,
        responseTime: r.response_time,
        priority: r.priority,
        priority_score: r.priority_score,
        risk_score: r.risk_score,
        anomaly: r.anomaly === 1,
        error: r.error
      }))
    };

    const report = await runPythonScript(NLP_SCRIPT, payload, ['--use-model']);
    res.json(report);
  } catch (e) {
    console.error('NLP Report Get error:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/report/pdf
 * Generates a PDF from a markdown report object
 */
router.post('/pdf', async (req, res) => {
  try {
    const reportData = req.body;
    if (!reportData || !reportData.markdown) {
      return res.status(400).json({ error: 'Valid report object required' });
    }
    const pdfResult = await runPythonScript(PDF_SCRIPT, reportData);
    res.json(pdfResult);
  } catch (e) {
    console.error('PDF Generate error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
