const axios = require('axios');

/**
 * Executes a single API test with axios, returns response metadata.
 */
async function executeTest(test, options = {}) {
  const start = Date.now();

  // Replace path params
  let url = test.endpoint;
  for (const [k, v] of Object.entries(test.pathParams || {})) {
    url = url.replace(`{${k}}`, encodeURIComponent(v));
  }

  const headers = { 'Content-Type': 'application/json' };
  if (options.jwt) headers['Authorization'] = `Bearer ${options.jwt}`;

  try {
    const resp = await axios({
      url,
      method: test.method,
      headers,
      params: test.queryParams,
      data: test.body,
      timeout: 15000,
      validateStatus: () => true,
    });
    const responseTime = Date.now() - start;
    return {
      statusCode: resp.status,
      data: resp.data,
      responseTime,
      success: true,
    };
  } catch (err) {
    return {
      statusCode: 0,
      data: null,
      responseTime: Date.now() - start,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Execute tests concurrently with a worker-pool pattern.
 */
async function executeTestsConcurrently(tests, concurrency = 5, options = {}) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tests.length) {
      const i = idx++;
      const r = await executeTest(tests[i], options);
      results[i] = { test: tests[i], result: r };
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, tests.length) }, worker);
  await Promise.all(workers);
  return results;
}

module.exports = { executeTest, executeTestsConcurrently };
