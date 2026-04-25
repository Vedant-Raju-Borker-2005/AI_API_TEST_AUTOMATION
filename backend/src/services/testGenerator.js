/**
 * Generates positive, negative, edge, and security test cases from parsed endpoints.
 */
function generateSampleValue(schema) {
  if (!schema) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case 'string':
      if (schema.format === 'email') return 'test@example.com';
      if (schema.format === 'date') return '2024-01-01';
      if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
      return 'sample';
    case 'integer': return schema.minimum || 1;
    case 'number': return 1.5;
    case 'boolean': return true;
    case 'array': return [generateSampleValue(schema.items)];
    case 'object': {
      const obj = {};
      const props = schema.properties || {};
      for (const [k, v] of Object.entries(props)) obj[k] = generateSampleValue(v);
      return obj;
    }
    default: return null;
  }
}

function generateInvalidValue(schema) {
  if (!schema) return null;
  if (schema.type === 'string') return 12345;
  if (schema.type === 'integer' || schema.type === 'number') return 'not_a_number';
  if (schema.type === 'boolean') return 'not_a_bool';
  return null;
}

function generateTestCases(endpoints) {
  const tests = [];

  for (const ep of endpoints) {
    const fullUrl = `${ep.baseUrl}${ep.path}`;

    // Build sample body & params
    const body = ep.requestBody && generateSampleValue(ep.requestBody.schema);
    const pathParams = {};
    const queryParams = {};
    for (const p of ep.parameters || []) {
      const val = generateSampleValue(p.schema || { type: 'string' });
      if (p.in === 'path') pathParams[p.name] = val;
      if (p.in === 'query') queryParams[p.name] = val;
    }

    // --- POSITIVE ---
    tests.push({
      testName: `[POSITIVE] ${ep.method} ${ep.path}`,
      endpoint: fullUrl,
      rawPath: ep.path,
      method: ep.method,
      pathParams,
      queryParams,
      body,
      expectedStatus: getSuccessStatus(ep),
      category: 'POSITIVE',
      responseSchema: getSchemaForStatus(ep, getSuccessStatus(ep)),
    });

    // --- NEGATIVE (missing required body) ---
    if (ep.requestBody && ep.requestBody.required) {
      tests.push({
        testName: `[NEGATIVE] ${ep.method} ${ep.path} - missing body`,
        endpoint: fullUrl,
        rawPath: ep.path,
        method: ep.method,
        pathParams,
        queryParams,
        body: null,
        expectedStatus: 400,
        category: 'NEGATIVE',
      });
    }

    // --- INVALID DATA ---
    if (body && typeof body === 'object') {
      const invalidBody = { ...body };
      const firstKey = Object.keys(invalidBody)[0];
      if (firstKey) {
        invalidBody[firstKey] = generateInvalidValue(
          ep.requestBody.schema.properties[firstKey]
        );
        tests.push({
          testName: `[NEGATIVE] ${ep.method} ${ep.path} - invalid types`,
          endpoint: fullUrl,
          rawPath: ep.path,
          method: ep.method,
          pathParams,
          queryParams,
          body: invalidBody,
          expectedStatus: 400,
          category: 'NEGATIVE',
        });
      }
    }

    // --- EDGE CASE (empty strings/zero) ---
    tests.push({
      testName: `[EDGE] ${ep.method} ${ep.path} - edge values`,
      endpoint: fullUrl,
      rawPath: ep.path,
      method: ep.method,
      pathParams,
      queryParams: { ...queryParams, _extra: '' },
      body: body ? { ...body } : null,
      expectedStatus: getSuccessStatus(ep),
      category: 'EDGE',
    });

    // --- SECURITY (SQLi / XSS payloads) ---
    const sqlPayload = "' OR '1'='1";
    tests.push({
      testName: `[SECURITY] ${ep.method} ${ep.path} - SQLi probe`,
      endpoint: fullUrl,
      rawPath: ep.path,
      method: ep.method,
      pathParams,
      queryParams: { ...queryParams, q: sqlPayload },
      body: body,
      expectedStatus: getSuccessStatus(ep),
      category: 'SECURITY',
    });
  }

  return tests;
}

function getSuccessStatus(ep) {
  const codes = Object.keys(ep.responses || {});
  const success = codes.find((c) => c.startsWith('2'));
  return success ? parseInt(success, 10) : 200;
}

function getSchemaForStatus(ep, status) {
  const r = ep.responses && ep.responses[String(status)];
  return r ? r.schema : null;
}

module.exports = { generateTestCases };
