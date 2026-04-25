const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateTestCases } = require('../services/testGenerator');
const { executeTestsConcurrently } = require('../services/executor');
const { executeWithChaining } = require('../services/chainExecutor');
const { validateResponse } = require('../services/validator');
const { scoreTests } = require('../services/mlService');
const { mapTestsToEndpoints } = require('../services/testMapper');
const { applyEnvironment } = require('../services/envManager');
const { db } = require('../db/database');

const router = express.Router();

router.post('/generate-tests', async (req, res) => {
  try {
    const endpoints = req.body.endpoints || [];
    const excelTests = req.body.excelTests || [];

    // Allow Excel-only OR spec-only OR combined — reject only when nothing provided
    if (!endpoints.length && !excelTests.length) {
      return res.status(400).json({
        error: 'Provide at least one OpenAPI endpoint or Excel test case to generate a test suite.',
      });
    }

    // 1. Auto-generate from OpenAPI endpoints (empty if none uploaded)
    const generated = endpoints.length ? generateTestCases(endpoints) : [];

    // 2. Map Excel/NL tests to endpoints (uses fallback URL if no spec)
    const mapped = excelTests.length
      ? mapTestsToEndpoints(excelTests, endpoints)
      : [];

    const allTests = [...generated, ...mapped];

    // 3. Load endpoint history for ML scoring
    const rows = db.prepare('SELECT * FROM endpoint_history').all();
    const history = {};
    for (const r of rows) history[`${r.method}:${r.endpoint}`] = r;

    const scored = await scoreTests(allTests, history);
    res.json({
      success: true,
      tests: scored,
      count: scored.length,
      stats: {
        generated: generated.length,
        fromExcel: mapped.length,
        total: allTests.length,
      },
    });
  } catch (e) {
    console.error('generate-tests error:', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/run-tests', async (req, res) => {
  try {
    const {
      tests,
      concurrency = 5,
      environment = null,
      chaining = false,
      auth = {},
    } = req.body;

    if (!tests || !Array.isArray(tests)) {
      return res.status(400).json({ error: 'tests array required' });
    }

    // Apply environment (if given) — overrides baseUrl + auth
    let runTests = tests;
    let effectiveAuth = auth;
    if (environment) {
      const applied = applyEnvironment(tests, environment);
      runTests = applied.tests;
      effectiveAuth = applied.auth || auth;
    }

    // Execute — chained OR concurrent
    let execResults;
    if (chaining) {
      const chained = await executeWithChaining(runTests, { auth: effectiveAuth });
      execResults = chained.results;
    } else {
      execResults = await executeTestsConcurrently(runTests, concurrency, {
        jwt: effectiveAuth.type === 'jwt' ? effectiveAuth.token : null,
        apiKey: effectiveAuth.type === 'apiKey' ? effectiveAuth.key : null,
      });
    }

    const results = execResults.map(({ test, result }) => {
      const v = validateResponse(test, result);
      return {
        testName: test.testName,
        endpoint: test.rawPath,
        method: test.method,
        category: test.category,
        status: v.status,
        statusCode: result.statusCode,
        responseTime: v.responseTime,
        error: v.errors.join('; '),
        priority: test.priority,
        priority_score: test.priority_score,
        risk_score: test.risk_score,
        risk_label: test.risk_label,
        anomaly: test.anomaly || (v.responseTime > 2000),
        environment: environment || 'default',
        source: test.source || 'generated',
      };
    });

    const total = results.length;
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = total - passed;
    const avgRT = results.reduce((a, r) => a + r.responseTime, 0) / (total || 1);

    const runId = uuidv4();
    const now = Date.now();
    db.prepare(
      `INSERT INTO test_runs (id, spec_name, created_at, total, passed, failed, avg_response_time, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(runId, environment || 'run', now, total, passed, failed, avgRT,
      JSON.stringify({ passRate: (passed / total) * 100, chaining }));

    const insertRes = db.prepare(
      `INSERT INTO test_results (id, run_id, test_name, endpoint, method, category, status, status_code, response_time, priority, priority_score, risk_score, anomaly, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateHist = db.prepare(
      `INSERT INTO endpoint_history (endpoint, method, failures, runs, avg_response_time, last_updated)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(endpoint, method) DO UPDATE SET
         failures = failures + excluded.failures,
         runs = runs + 1,
         avg_response_time = (avg_response_time * runs + excluded.avg_response_time) / (runs + 1),
         last_updated = excluded.last_updated`
    );

    for (const r of results) {
      insertRes.run(uuidv4(), runId, r.testName, r.endpoint, r.method, r.category,
        r.status, r.statusCode, r.responseTime, r.priority, r.priority_score,
        r.risk_score, r.anomaly ? 1 : 0, r.error, now);
      updateHist.run(r.endpoint, r.method, r.status === 'FAIL' ? 1 : 0, r.responseTime, now);
    }

    res.json({
      success: true, runId,
      summary: {
        total, passed, failed,
        passRate: ((passed / total) * 100).toFixed(1),
        failRate: ((failed / total) * 100).toFixed(1),
        avgResponseTime: Math.round(avgRT),
        anomalies: results.filter((r) => r.anomaly).length,
        environment: environment || 'default',
        chaining,
      },
      results,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/results', (_req, res) => {
  const runs = db.prepare('SELECT * FROM test_runs ORDER BY created_at DESC LIMIT 20').all();
  res.json({ runs });
});

router.get('/results/:runId', (req, res) => {
  const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(req.params.runId);
  const results = db.prepare('SELECT * FROM test_results WHERE run_id = ?').all(req.params.runId);
  res.json({ run, results });
});

module.exports = router;
