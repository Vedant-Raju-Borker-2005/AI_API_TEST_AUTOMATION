const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const testRoutes   = require('./routes/tests');
const mlRoutes     = require('./routes/ml');
const reportRoutes = require('./routes/report');
const envRoutes    = require('./routes/environments');
const { initDB }   = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});
app.use('/api/', limiter);

// Initialize DB
initDB();

// Routes
app.use('/api', uploadRoutes);
app.use('/api', testRoutes);
app.use('/api', mlRoutes);
app.use('/api/report', reportRoutes);
app.use('/api', envRoutes);

// Root route — show API info
app.get('/', (_req, res) => {
  res.json({
    name: 'NexusAI — AI API Test Automation',
    version: '1.0.0',
    status: 'online',
    message: 'Backend API is running. See /api/health for health check.',
    endpoints: [
      'POST /api/upload',
      'POST /api/upload-excel',
      'GET  /api/samples/openapi',
      'GET  /api/samples/excel',
      'POST /api/generate-tests',
      'POST /api/run-tests',
      'GET  /api/results',
      'GET  /api/results/:runId',
      'GET  /api/environments',
      'POST /api/train-models',
      'POST /api/monitor/logs',
      'POST /api/report/generate',
      'GET  /api/report/:runId',
      'POST /api/report/pdf',
      'GET  /api/health',

    ],
    timestamp: Date.now(),
  });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'NexusAI API',
    status: 'online',
    version: '1.0.0',
    timestamp: Date.now(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: Date.now() });
});

app.use((err, _req, res, _next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});
