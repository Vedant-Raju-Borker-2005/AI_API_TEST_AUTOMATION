/**
 * Full End-to-End Demo Script
 * Uploads test datasets, generates AI-scored tests, runs them, and displays results.
 */
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');

const API = 'http://localhost:5000/api';

function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function httpFormUpload(url, fieldName, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    const body = Buffer.concat([Buffer.from(header), fileData, Buffer.from(footer)]);

    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const BASE = path.resolve(__dirname, '../../test_datasets');

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         AI API TESTER — FULL END-TO-END DEMO               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── STEP 1: Upload OpenAPI Spec ──
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 1: Uploading Vulnerable OpenAPI Spec...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const specResult = await httpFormUpload(
    `${API}/upload`, 'spec',
    path.join(BASE, 'openapi_vulnerable.json')
  );
  console.log(`✅ Parsed ${specResult.endpoints?.length || 0} endpoints from spec`);
  if (specResult.endpoints) {
    specResult.endpoints.forEach(ep => {
      console.log(`   ${ep.method.padEnd(7)} ${ep.path}  (${ep.summary})`);
    });
  }

  // ── STEP 2: Upload Excel Test Cases ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 2: Uploading Excel NL Test Cases...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const excelResult = await httpFormUpload(
    `${API}/upload-excel`, 'excel',
    path.join(BASE, 'excel_test_cases.xlsx')
  );
  console.log(`✅ Parsed ${excelResult.count || 0} NL test cases from Excel`);
  if (excelResult.tests) {
    excelResult.tests.forEach(t => {
      console.log(`   [${t.category}] ${t.method.padEnd(7)} ${t.endpoint}  — "${t.testName}"`);
    });
  }

  // ── STEP 3: Generate AI-Scored Test Suite ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 3: Generating AI-Scored Test Suite (ML Inference)...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const genPayload = JSON.stringify({
    endpoints: specResult.endpoints,
    excelTests: excelResult.tests || [],
  });

  const genResult = await httpRequest(`${API}/generate-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: genPayload,
  });

  console.log(`✅ Generated ${genResult.count || 0} tests (${genResult.stats?.generated} auto + ${genResult.stats?.fromExcel} from Excel)`);
  console.log('\n   ┌──────────┬──────────────────────────────────────┬──────────┬────────────┬─────────┐');
  console.log('   │ Method   │ Endpoint                             │ Priority │ Risk Score │ Anomaly │');
  console.log('   ├──────────┼──────────────────────────────────────┼──────────┼────────────┼─────────┤');
  if (genResult.tests) {
    genResult.tests.forEach(t => {
      const method = (t.method || '').padEnd(8);
      const ep = (t.rawPath || t.endpoint || '').slice(0, 36).padEnd(36);
      const prio = (t.priority || 'N/A').padEnd(8);
      const risk = (t.risk_score != null ? t.risk_score.toFixed(1) : 'N/A').toString().padEnd(10);
      const anomaly = t.anomaly ? '⚠️  YES' : '   —  ';
      console.log(`   │ ${method} │ ${ep} │ ${prio} │ ${risk} │ ${anomaly} │`);
    });
  }
  console.log('   └──────────┴──────────────────────────────────────┴──────────┴────────────┴─────────┘');

  // ── STEP 4: Run the Tests ──
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('STEP 4: Executing Tests & Collecting Results...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const runPayload = JSON.stringify({
    tests: genResult.tests || [],
    concurrency: 5,
    chaining: false,
  });

  const runResult = await httpRequest(`${API}/run-tests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: runPayload,
  });

  const s = runResult.summary || {};
  console.log('\n   ╔════════════════════════════════════════════╗');
  console.log('   ║          📊  TEST EXECUTION SUMMARY        ║');
  console.log('   ╠════════════════════════════════════════════╣');
  console.log(`   ║  Total Tests     :  ${String(s.total || 0).padEnd(20)} ║`);
  console.log(`   ║  Passed          :  ${String(s.passed || 0).padEnd(20)} ║`);
  console.log(`   ║  Failed          :  ${String(s.failed || 0).padEnd(20)} ║`);
  console.log(`   ║  Pass Rate       :  ${String((s.passRate || 0) + '%').padEnd(20)} ║`);
  console.log(`   ║  Avg Resp Time   :  ${String((s.avgResponseTime || 0) + 'ms').padEnd(20)} ║`);
  console.log(`   ║  Anomalies       :  ${String(s.anomalies || 0).padEnd(20)} ║`);
  console.log(`   ║  Environment     :  ${String(s.environment || 'default').padEnd(20)} ║`);
  console.log('   ╚════════════════════════════════════════════╝');

  // ── STEP 5: Detailed Results Table ──
  console.log('\n   Detailed Results:');
  console.log('   ┌──────────────────────────────────┬────────┬────────┬──────────┬──────┬─────────┐');
  console.log('   │ Test Name                        │ Method │ Status │ Priority │ Risk │ Anomaly │');
  console.log('   ├──────────────────────────────────┼────────┼────────┼──────────┼──────┼─────────┤');
  if (runResult.results) {
    runResult.results.forEach(r => {
      const name = (r.testName || '').slice(0, 32).padEnd(32);
      const method = (r.method || '').padEnd(6);
      const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
      const prio = (r.priority || '').padEnd(8);
      const risk = (r.risk_score != null ? r.risk_score.toFixed(1) : '-').toString().padEnd(4);
      const anomaly = r.anomaly ? '⚠️' : ' —';
      console.log(`   │ ${name} │ ${method} │ ${status} │ ${prio} │ ${risk} │   ${anomaly}   │`);
    });
  }
  console.log('   └──────────────────────────────────┴────────┴────────┴──────────┴──────┴─────────┘');

  console.log('\n✅ DEMO COMPLETE! The AI scored, prioritized, and executed all tests successfully.');
}

main().catch(console.error);
