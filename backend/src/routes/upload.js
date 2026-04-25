const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { parseOpenAPI } = require('../services/openapiParser');
const { parseExcelTestCases } = require('../services/excelParser');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.json', '.yaml', '.yml', '.xlsx', '.xls', '.csv'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: "${ext}". Allowed types: ${allowed.join(', ')}`));
    }
  },
});

// Cleanup helper — removes temp uploaded file
function cleanupFile(filePath) {
  try { if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath); }
  catch { /* ignore cleanup errors */ }
}

/**
 * Wraps multer middleware in a Promise so errors can be caught with try/catch
 * instead of relying on Express error-handler placement.
 */
function runMulter(middleware, req, res) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// OpenAPI upload
router.post('/upload', async (req, res) => {
  try {
    // Run multer inline so errors are caught immediately
    await runMulter(upload.single('spec'), req, res);
  } catch (multerErr) {
    return res.status(400).json({ error: multerErr.message });
  }

  try {
    let spec;
    if (req.file) {
      const raw = fs.readFileSync(req.file.path, 'utf8');
      cleanupFile(req.file.path);
      const ext = path.extname(req.file.originalname).toLowerCase();
      try {
        if (ext === '.yaml' || ext === '.yml') {
          spec = yaml.load(raw);
        } else {
          spec = JSON.parse(raw);
        }
      } catch {
        return res.status(400).json({ error: 'Uploaded file is not valid JSON or YAML.' });
      }
    } else if (req.body && req.body.spec) {
      spec = typeof req.body.spec === 'string' ? JSON.parse(req.body.spec) : req.body.spec;
    } else {
      return res.status(400).json({ error: 'No spec provided. Upload a .json or .yaml file.' });
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      console.error('Upload failed: Spec has no paths. Keys found:', Object.keys(spec));
      
      // Check if it's a Postman Collection
      if (spec.info && (spec.info._postman_id || spec.item)) {
        return res.status(400).json({ 
          error: 'Uploaded file appears to be a Postman Collection. NexusAI requires an OpenAPI/Swagger (JSON/YAML) specification to generate tests.' 
        });
      }
      
      return res.status(400).json({ error: 'OpenAPI spec has no paths defined. Ensure you are uploading a valid OpenAPI/Swagger specification.' });
    }

    const parsed = parseOpenAPI(spec);
    res.json({ success: true, ...parsed });
  } catch (e) {
    console.error('OpenAPI Upload Exception:', e);
    if (req.file) cleanupFile(req.file.path);
    res.status(400).json({ error: 'Invalid OpenAPI spec: ' + e.message });
  }
});

// Excel test-cases upload
router.post('/upload-excel', async (req, res) => {
  try {
    // Run multer inline so errors (file size, file type) are caught immediately
    await runMulter(upload.single('excel'), req, res);
  } catch (multerErr) {
    return res.status(400).json({ error: multerErr.message });
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please select an .xlsx, .xls, or .csv file.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
      cleanupFile(req.file.path);
      return res.status(400).json({ error: `Invalid file type: "${ext}". Please upload an .xlsx, .xls, or .csv file.` });
    }

    const buf = fs.readFileSync(req.file.path);
    cleanupFile(req.file.path);

    // parseExcelTestCases now returns { tests, warnings }
    const { tests, warnings } = parseExcelTestCases(buf);

    res.json({
      success: true,
      count: tests.length,
      tests,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (e) {
    if (req.file) cleanupFile(req.file.path);
    res.status(400).json({ error: 'Excel parse failed: ' + e.message });
  }
});

// Multer error handler (file size, file type)
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    console.error('Multer/Upload Error:', err);
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Serve samples
router.get('/samples/openapi', (_req, res) => {
  const p = path.resolve(__dirname, '../../../samples/real_sample_openapi.json');
  if (fs.existsSync(p)) {
    res.download(p, 'sample_openapi.json');
  } else {
    res.status(404).json({ error: 'Sample OpenAPI spec not found.' });
  }
});

router.get('/samples/excel', (_req, res) => {
  const p = path.resolve(__dirname, '../../../samples/sample_tests.xlsx');
  if (fs.existsSync(p)) {
    res.download(p, 'sample_tests.xlsx');
  } else {
    res.status(404).json({ error: 'Sample Excel file not found.' });
  }
});

module.exports = router;
