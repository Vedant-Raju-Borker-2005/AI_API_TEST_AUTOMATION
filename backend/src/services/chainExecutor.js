const axios = require('axios');
const { JSONPath } = require('jsonpath-plus');

/**
 * Chain-aware executor.
 *  - Resolves {{context.var}} placeholders in URL/body/headers/params
 *  - Runs tests in dependency order (topological-ish)
 *  - Extracts values from responses via JSONPath for downstream tests
 */
async function executeWithChaining(tests, options = {}) {
  const context = { ...(options.initialContext || {}) };
  const byId = {};
  for (const t of tests) if (t.id) byId[t.id] = t;

  const ordered = topoSort(tests);
  const results = [];

  for (const test of ordered) {
    const resolved = resolvePlaceholders(test, context);
    const start = Date.now();

    let result;
    try {
      const resp = await axios({
        url: buildUrl(resolved),
        method: resolved.method,
        headers: buildHeaders(resolved, options),
        params: resolved.queryParams || {},
        data: resolved.body,
        timeout: 15000,
        validateStatus: () => true,
      });
      result = {
        statusCode: resp.status,
        data: resp.data,
        responseTime: Date.now() - start,
        success: true,
      };
    } catch (err) {
      result = {
        statusCode: 0, data: null,
        responseTime: Date.now() - start,
        success: false, error: err.message,
      };
    }

    // Extract values into context for downstream tests
    if (resolved.extract && result.data) {
      for (const [key, path] of Object.entries(resolved.extract)) {
        try {
          const val = JSONPath({ path, json: result.data, wrap: false });
          if (val !== undefined) context[key] = val;
        } catch (e) { /* ignore */ }
      }
    }

    results.push({ test: resolved, result });
  }

  return { results, context };
}

function topoSort(tests) {
  const visited = new Set();
  const out = [];
  const byId = Object.fromEntries(tests.filter((t) => t.id).map((t) => [t.id, t]));

  function visit(t) {
    if (!t || visited.has(t.id || t.testName)) return;
    visited.add(t.id || t.testName);
    if (t.dependsOn && byId[t.dependsOn]) visit(byId[t.dependsOn]);
    out.push(t);
  }
  tests.forEach(visit);
  return out;
}

function resolvePlaceholders(test, ctx) {
  const deep = (v) => {
    if (v == null) return v;
    if (typeof v === 'string') return v.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, k) => {
      const val = getByPath(ctx, k.trim());
      return val !== undefined ? val : `{{${k}}}`;
    });
    if (Array.isArray(v)) return v.map(deep);
    if (typeof v === 'object') {
      const o = {};
      for (const [k, val] of Object.entries(v)) o[k] = deep(val);
      return o;
    }
    return v;
  };
  return {
    ...test,
    endpoint: deep(test.endpoint),
    rawPath: deep(test.rawPath),
    body: deep(test.body),
    headers: deep(test.headers),
    queryParams: deep(test.queryParams),
    pathParams: deep(test.pathParams),
  };
}

function getByPath(obj, path) {
  return path.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);
}

function buildUrl(t) {
  let url = t.endpoint;
  for (const [k, v] of Object.entries(t.pathParams || {})) {
    url = url.replace(`{${k}}`, encodeURIComponent(v));
  }
  return url;
}

function buildHeaders(t, options) {
  const headers = { 'Content-Type': 'application/json', ...(t.headers || {}) };
  const auth = options.auth || {};

  if (auth.type === 'jwt' && auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  } else if (auth.type === 'apiKey' && auth.key) {
    headers[auth.headerName || 'X-API-Key'] = auth.key;
  } else if (auth.type === 'basic' && auth.username) {
    const b64 = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
    headers['Authorization'] = `Basic ${b64}`;
  }
  return headers;
}

module.exports = { executeWithChaining };
