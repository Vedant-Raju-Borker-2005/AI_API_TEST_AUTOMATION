const XLSX = require('xlsx');

/**
 * Parses Excel file containing NL test cases.
 * Expected columns (flexible - case-insensitive, spaces/underscores stripped):
 *   Test Name | Description | Method | Endpoint | Body/Request Body | Headers |
 *   Query Params | Expected Status | Expected Response | Category |
 *   DependsOn | Extract | Environment
 *
 * "Description" can be natural language — we map it to intent.
 */
function parseExcelTestCases(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: 'buffer' });
  } catch (e) {
    throw new Error('Invalid Excel file. Ensure it is a valid .xlsx or .xls file.');
  }

  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('Excel file contains no sheets.');
  }

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rows.length === 0) {
    throw new Error('Excel sheet is empty. Please add at least one test case row.');
  }

  const parsed = [];
  const errors = [];

  rows.forEach((row, idx) => {
    try {
      const normalized = normalizeKeys(row);
      const nlIntent = interpretNL(
        (normalized.description || normalized.testname || '') + ' ' +
        (normalized.category || '')
      );

      // Resolve body from multiple possible column names
      const bodyRaw = normalized.requestbody || normalized.body || normalized.payload || '';
      // Resolve query params from multiple possible column names
      const qpRaw = normalized.queryparams || normalized.queryparameters || '';
      // Resolve explicit category (prefer Excel column over NL inference)
      const explicitCategory = (normalized.category || '').toUpperCase().trim();
      const validCategories = ['POSITIVE', 'NEGATIVE', 'EDGE', 'SECURITY'];
      const finalCategory = validCategories.includes(explicitCategory)
        ? explicitCategory
        : nlIntent.category || 'POSITIVE';

      const testCase = {
        id: normalized.id || `tc_${idx + 1}`,
        testName: normalized.testname || normalized.name || `Test ${idx + 1}`,
        description: normalized.description || '',
        method: (normalized.method || nlIntent.method || 'GET').toUpperCase(),
        endpoint: normalized.endpoint || normalized.url || nlIntent.endpointHint || '',
        body: safeParseJSON(bodyRaw),
        headers: safeParseJSON(normalized.headers),
        pathParams: safeParseJSON(normalized.pathparams || normalized.pathparameters),
        queryParams: safeParseJSON(qpRaw),
        expectedStatus: parseInt(normalized.expectedstatus, 10) || nlIntent.expectedStatus || 200,
        expectedResponse: safeParseJSON(normalized.expectedresponse),
        dependsOn: normalized.dependson || null,
        extract: safeParseJSON(normalized.extract),
        environment: normalized.environment || 'default',
        category: finalCategory,
        source: 'excel',
      };

      // Warn if no endpoint specified
      if (!testCase.endpoint) {
        errors.push(`Row ${idx + 2}: No endpoint specified for "${testCase.testName}".`);
      }

      parsed.push(testCase);
    } catch (rowErr) {
      errors.push(`Row ${idx + 2}: ${rowErr.message}`);
    }
  });

  if (errors.length > 0) {
    console.warn('⚠️ Excel parse warnings:', errors);
  }

  // Return structured object — avoids the fragile _warnings-on-array pattern
  return { tests: parsed, warnings: errors };
}

function normalizeKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.toString().toLowerCase().replace(/[\s_-]/g, '')] = v;
  }
  return out;
}

function safeParseJSON(val) {
  if (!val && val !== 0) return null;
  if (typeof val === 'object') return val;
  const str = String(val).trim();
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

/**
 * Very lightweight NL interpreter — maps keywords in human descriptions
 * to testing intents. (Rule-based NLP; no LLM dependency.)
 */
function interpretNL(text) {
  const t = (text || '').toLowerCase();
  const result = { method: null, category: 'POSITIVE', expectedStatus: null, endpointHint: null };

  // Method detection
  if (/\b(create|add|register|post|submit)\b/.test(t)) result.method = 'POST';
  else if (/\b(update|modify|edit|patch)\b/.test(t)) result.method = 'PATCH';
  else if (/\b(replace|put)\b/.test(t)) result.method = 'PUT';
  else if (/\b(delete|remove)\b/.test(t)) result.method = 'DELETE';
  else if (/\b(get|fetch|retrieve|list|read|view)\b/.test(t)) result.method = 'GET';

  // Category & expected status
  if (/\b(invalid|wrong|bad|missing|fail|error|reject|unauthori[sz]ed)\b/.test(t)) {
    result.category = 'NEGATIVE';
    result.expectedStatus = /unauthori[sz]ed|forbidden/.test(t) ? 401 : 400;
  } else if (/\b(not found|404|nonexistent)\b/.test(t)) {
    result.category = 'NEGATIVE';
    result.expectedStatus = 404;
  } else if (/\b(sql|xss|injection|attack|security)\b/.test(t)) {
    result.category = 'SECURITY';
  } else if (/\b(edge|boundary|empty|null|max|min)\b/.test(t)) {
    result.category = 'EDGE';
  }

  // Endpoint hint (/users, /products, etc.)
  const m = t.match(/\/[a-z0-9_\-{}\/]+/);
  if (m) result.endpointHint = m[0];

  return result;
}

module.exports = { parseExcelTestCases };
