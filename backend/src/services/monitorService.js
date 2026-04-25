const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON = process.env.PYTHON_BIN || 'python';
const PREDICT_SCRIPT = path.resolve(__dirname, '../../../ml_scripts/training/predict.py');
const MODELS_DIR = path.resolve(__dirname, '../../ml/models');

// In-memory sliding window state for IP tracking
const ipHistory = {};

/**
 * Clean up old IP history to prevent memory leaks (keep last 5 minutes)
 */
setInterval(() => {
  const now = Date.now();
  for (const ip in ipHistory) {
    ipHistory[ip] = ipHistory[ip].filter(t => now - t.timestamp < 5 * 60 * 1000);
    if (ipHistory[ip].length === 0) delete ipHistory[ip];
  }
}, 60000);

/**
 * Checks for known SQLi, XSS, or LFI attack patterns in the path.
 */
function checkAttackSignature(requestPath) {
  const keywords = ['union', 'select', 'script', 'drop', '%27', '%20', 'exec', 'alert'];
  const lowerPath = (requestPath || '').toLowerCase();
  for (const kw of keywords) {
    if (lowerPath.includes(kw)) return 1;
  }
  return 0;
}

/**
 * Builds runtime features for the ML model based on live logs.
 */
function buildLiveFeatures(log) {
  const now = Date.now();
  const ip = log.ip_address || 'unknown';
  
  if (!ipHistory[ip]) ipHistory[ip] = [];
  ipHistory[ip].push({ timestamp: now, status_code: log.status_code });

  const recentRequests = ipHistory[ip];
  const requestFrequency = recentRequests.length;
  const errorCount = recentRequests.filter(r => r.status_code >= 400).length;
  const errorRate = requestFrequency > 0 ? errorCount / requestFrequency : 0;
  
  const suspiciousIpFlag = ((errorRate > 0.5 && requestFrequency > 5) || requestFrequency > 100) ? 1 : 0;
  const attackSig = checkAttackSignature(log.path);

  const methodRisk = { GET: 1, POST: 2, PUT: 3, PATCH: 3, DELETE: 4 }[log.method?.toUpperCase()] || 1;
  
  // Estimate params from path
  const paramCount = log.path ? (log.path.split('?').length > 1 ? 1 : (log.path.split('/').length - 1)) : 0;

  return {
    historical_failure_rate: errorRate,
    param_count: paramCount,
    field_count: log.bytes_sent > 1000 ? 5 : 1, // rough heuristic
    category_weight: attackSig ? 5 : 1,
    method_risk: methodRisk,
    avg_response_time: log.response_time_ms || 200,
    flakiness: errorRate, // simplified for real-time
    request_frequency_per_ip: requestFrequency,
    error_rate_per_ip: errorRate,
    suspicious_ip_flag: suspiciousIpFlag,
    attack_signature: attackSig
  };
}

/**
 * Call the Python predictor
 */
async function callPython(payload) {
  return new Promise((resolve) => {
    if (!fs.existsSync(PREDICT_SCRIPT) || !fs.existsSync(MODELS_DIR)) {
      console.warn("Predict script or models dir missing!");
      return resolve(null);
    }
    const proc = spawn(PYTHON, [PREDICT_SCRIPT, MODELS_DIR]);
    let stdout = '';
    proc.stdout.on('data', (d) => (stdout += d));
    proc.on('close', () => {
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve(null);
      }
    });
    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

/**
 * Ingest live traffic log and alert if threshold crossed.
 */
async function ingestLiveLog(log) {
  const features = buildLiveFeatures(log);
  const mlOut = await callPython({ action: 'predict', features: [features] });
  
  if (!mlOut || !mlOut[0]) return { success: false, reason: 'ML failure' };

  const pred = mlOut[0];
  
  // Alert Threshold Logic
  if (pred.anomaly === 1 && pred.risk_score > 8) {
    console.error(`🚨 [CRITICAL_SECURITY_ALERT] Potential Attack Detected from IP: ${log.ip_address}`);
    console.error(`   Path: ${log.path} | Score: ${pred.risk_score} | Sig: ${features.attack_signature}`);
  }

  return {
    log_id: log.id,
    features_extracted: features,
    prediction: pred
  };
}

module.exports = { ingestLiveLog, buildLiveFeatures };
