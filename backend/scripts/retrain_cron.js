const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON = process.env.PYTHON_BIN || 'python';
const TRAIN_SCRIPT = path.resolve(__dirname, '../../ml_scripts/pipeline/train_real.py');
const MODELS_DIR = path.resolve(__dirname, '../ml/models');
const DRIFT_LOG = path.resolve(__dirname, '../ml/drift_log.json');

function appendDriftLog(metrics) {
  let logs = [];
  if (fs.existsSync(DRIFT_LOG)) {
    try {
      logs = JSON.parse(fs.readFileSync(DRIFT_LOG, 'utf8'));
    } catch (e) {
      console.error("Error reading drift log:", e.message);
    }
  }
  
  logs.push({
    timestamp: new Date().toISOString(),
    ...metrics
  });

  // Keep last 50 entries
  if (logs.length > 50) logs.shift();

  fs.writeFileSync(DRIFT_LOG, JSON.stringify(logs, null, 2));

  // Drift Alerting
  if (logs.length > 1) {
    const prev = logs[logs.length - 2];
    if (Math.abs(metrics.anomalyRate - prev.anomalyRate) > 0.10) {
      console.warn(`\n⚠️ [MODEL DRIFT ALERT] Anomaly rate shifted by > 10%! (Old: ${prev.anomalyRate}, New: ${metrics.anomalyRate})`);
    }
  }
}

function runRetraining() {
  console.log(`[${new Date().toISOString()}] 🚀 Starting Automated Model Retraining...`);
  
  const proc = spawn(PYTHON, [TRAIN_SCRIPT, MODELS_DIR]);
  let output = '';

  proc.stdout.on('data', (d) => {
    output += d.toString();
    process.stdout.write(d);
  });

  proc.stderr.on('data', (d) => {
    process.stderr.write(d);
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`❌ Retraining failed with exit code ${code}`);
      return;
    }

    console.log("✅ Retraining complete! Analyzing metrics for drift...");
    
    // Extract metrics from stdout using regex
    const anomalyMatch = output.match(/Anomaly Rate Detected: ([\d.]+)%/);
    const prioMseMatch = output.match(/Priority Model MSE: ([\d.]+)/);
    const riskMseMatch = output.match(/Risk Model MSE: ([\d.]+)/);

    const metrics = {
      anomalyRate: anomalyMatch ? parseFloat(anomalyMatch[1]) / 100 : null,
      priorityMse: prioMseMatch ? parseFloat(prioMseMatch[1]) : null,
      riskMse: riskMseMatch ? parseFloat(riskMseMatch[1]) : null,
    };

    appendDriftLog(metrics);
  });
}

// Schedule to run at 3:00 AM every Sunday (for production)
// "0 3 * * 0"
// For demonstration/testing, we can run it every hour: "0 * * * *"
const scheduleStr = process.env.CRON_SCHEDULE || "0 3 * * 0";

console.log(`📅 Automated Retraining Cron scheduled: [${scheduleStr}]`);
cron.schedule(scheduleStr, runRetraining);

module.exports = { runRetraining };

// Allow manual trigger if run directly
if (require.main === module) {
  runRetraining();
}
