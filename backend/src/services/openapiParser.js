/**
 * Parses OpenAPI 3.x spec and extracts endpoints for test generation.
 */
function parseOpenAPI(spec) {
  const endpoints = [];
  const paths = spec.paths || {};
  const baseUrl =
    (spec.servers && spec.servers[0] && spec.servers[0].url) ||
    'http://localhost:3000';

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;

      const params = operation.parameters || [];
      const requestBody = operation.requestBody || null;
      const responses = operation.responses || {};

      endpoints.push({
        path: pathKey,
        method: method.toUpperCase(),
        operationId: operation.operationId || `${method}_${pathKey}`,
        summary: operation.summary || '',
        parameters: params,
        requestBody: resolveRequestBody(requestBody, spec),
        responses: resolveResponses(responses, spec),
        baseUrl,
      });
    }
  }
  return { endpoints, info: spec.info || {}, baseUrl };
}

function resolveRef(ref, spec) {
  if (!ref) return null;
  const parts = ref.replace('#/', '').split('/');
  let cur = spec;
  for (const p of parts) cur = cur && cur[p];
  return cur;
}

function resolveSchema(schema, spec) {
  if (!schema) return null;
  if (schema.$ref) return resolveSchema(resolveRef(schema.$ref, spec), spec);
  if (schema.type === 'object' && schema.properties) {
    const resolved = { ...schema, properties: {} };
    for (const [k, v] of Object.entries(schema.properties)) {
      resolved.properties[k] = resolveSchema(v, spec);
    }
    return resolved;
  }
  if (schema.type === 'array' && schema.items) {
    return { ...schema, items: resolveSchema(schema.items, spec) };
  }
  return schema;
}

function resolveRequestBody(rb, spec) {
  if (!rb) return null;
  const content = rb.content && rb.content['application/json'];
  if (!content) return null;
  return { schema: resolveSchema(content.schema, spec), required: rb.required };
}

function resolveResponses(responses, spec) {
  const out = {};
  for (const [code, r] of Object.entries(responses)) {
    const content = r.content && r.content['application/json'];
    out[code] = {
      description: r.description,
      schema: content ? resolveSchema(content.schema, spec) : null,
    };
  }
  return out;
}

module.exports = { parseOpenAPI };
