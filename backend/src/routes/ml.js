const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { scoreTests } = require('../services/mlService');
const { ingestLiveLog } = require('../services/monitorService');

const router = express.Router();

router.post('/score-endpoints', async (req, res) => {
  try {
    const { tests } = req.body;
    const scored = await scoreTests(tests || []);
    res.json({ success: true, scored });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/monitor/logs', async (req, res) => {
  try {
    const log = req.body;
    const result = await ingestLiveLog(log);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/train-models', (_req, res) => {
  const script = path.resolve(__dirname, '../../../ml_scripts/pipeline/train_real.py');
  const modelsDir = path.resolve(__dirname, '../../ml/models');
  const proc = spawn(process.env.PYTHON_BIN || 'python', [script, modelsDir]);

  let out = '';
  let err = '';
  proc.stdout.on('data', (d) => (out += d));
  proc.stderr.on('data', (d) => (err += d));
  proc.on('close', (code) => {
    if (code === 0) res.json({ success: true, output: out });
    else res.status(500).json({ error: err || 'training failed', output: out });
  });
});

module.exports = router;
