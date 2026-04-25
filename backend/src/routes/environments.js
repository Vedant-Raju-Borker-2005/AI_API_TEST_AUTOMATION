const express = require('express');
const { listEnvironments, getEnvironment, upsertEnvironment } = require('../services/envManager');

const router = express.Router();

router.get('/environments', (_req, res) => {
  res.json({ environments: listEnvironments() });
});

router.get('/environments/:name', (req, res) => {
  const env = getEnvironment(req.params.name);
  if (!env) return res.status(404).json({ error: 'not found' });
  res.json({ environment: env });
});

router.post('/environments', (req, res) => {
  try {
    const env = upsertEnvironment(req.body);
    res.json({ success: true, environment: env });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
