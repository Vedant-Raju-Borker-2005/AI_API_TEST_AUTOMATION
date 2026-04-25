const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON = process.env.PYTHON_BIN || 'python';
const PREDICT_SCRIPT = path.resolve(__dirname, '../../../ml_scripts/training/predict.py');
const MODELS_DIR = path.resolve(__dirname, '../../ml/models');

/**
 * Call the Python predictor with test features; fall back to heuristic scoring.
 */
async function callPython(payload) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PREDICT_SCRIPT) || !fs.existsSync(MODELS_DIR)) {
      return resolve(null);
    }
    const proc = spawn(PYTHON, [PREDICT_SCRIPT, MODELS_DIR]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));
    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        console.warn('⚠️ ML fallback (parse err):', stderr || e.message);
        resolve(null);
      }
    });
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

// -------- Feature engineering --------
function buildFeatures(test, history = {}) {
  const key = `${test.method}:${test.rawPath}`;
  const h = history[key] || { failures: 0, runs: 0, avg_response_time: 200 };
  const methodRisk = { GET: 1, POST: 3, PUT: 3, PATCH: 3, DELETE: 4 }[test.method] || 2;
  const categoryWeight = { POSITIVE: 1, NEGATIVE: 2, EDGE: 3, SECURITY: 5 }[test.category] || 1;

  // Check for attack signatures in test path or body
  const attackSig = checkAttackSignature(test.rawPath || '') || checkAttackSignature(JSON.stringify(test.body || {}));

  return {
    historical_failure_rate: h.runs ? h.failures / h.runs : 0.1,
    param_count: Object.keys(test.queryParams || {}).length + Object.keys(test.pathParams || {}).length,
    field_count: test.body ? Object.keys(test.body).length : 0,
    category_weight: categoryWeight,
    method_risk: methodRisk,
    avg_response_time: h.avg_response_time || 200,
    flakiness: h.runs > 3 ? Math.min(1, h.failures / h.runs) : 0.2,
    request_frequency_per_ip: 0, // Not applicable for synthetic pre-test
    error_rate_per_ip: 0,        // Not applicable for synthetic pre-test
    suspicious_ip_flag: 0,       // Not applicable for synthetic pre-test
    attack_signature: attackSig
  };
}

function checkAttackSignature(str) {
  const keywords = ['union', 'select', 'script', 'drop', '%27', '%20', 'exec', 'alert'];
  const lowerStr = str.toLowerCase();
  for (const kw of keywords) {
    if (lowerStr.includes(kw)) return 1;
  }
  return 0;
}

// -------- Heuristic fallback --------
function heuristicPredict(features) {
  const priority =
    Math.min(1,
      0.3 * features.historical_failure_rate +
      0.2 * (features.category_weight / 5) +
      0.2 * (features.method_risk / 4) +
      0.15 * features.flakiness +
      0.15 * Math.min(1, features.param_count / 10)
    );
  const risk = 1 + priority * 9;
  const anomaly = features.avg_response_time > 2000 ? 1 : 0;
  return { priority_score: priority, risk_score: risk, anomaly };
}

function labelPriority(p) {
  if (p >= 0.8) return 'CRITICAL';
  if (p >= 0.6) return 'HIGH';
  if (p >= 0.4) return 'MEDIUM';
  return 'LOW';
}

function labelRisk(r) {
  if (r >= 8) return 'Critical';
  if (r >= 6) return 'High';
  if (r >= 4) return 'Medium';
  return 'Low';
}

async function scoreTests(tests, history = {}) {
  const features = tests.map((t) => buildFeatures(t, history));
  const mlOut = await callPython({ action: 'predict', features });

  const scored = tests.map((t, i) => {
    const pred = mlOut && mlOut[i] ? mlOut[i] : heuristicPredict(features[i]);
    return {
      ...t,
      features: features[i],
      priority_score: pred.priority_score,
      priority: labelPriority(pred.priority_score),
      risk_score: pred.risk_score,
      risk_label: labelRisk(pred.risk_score),
      anomaly: pred.anomaly === 1,
      mlSource: mlOut ? 'ml' : 'heuristic',
    };
  });

  // Sort by priority score (highest first)
  scored.sort((a, b) => b.priority_score - a.priority_score);
  return scored;
}

module.exports = { scoreTests, buildFeatures, heuristicPredict };
