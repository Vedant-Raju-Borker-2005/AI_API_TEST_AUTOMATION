/**
 * Maps Excel/NL test cases to OpenAPI endpoints intelligently.
 * Uses fuzzy path matching + method alignment.
 */
function mapTestsToEndpoints(excelTests, endpoints) {
  // Derive default baseUrl from first endpoint if available
  const defaultBaseUrl = endpoints.length > 0 ? endpoints[0].baseUrl : 'http://localhost:3000';

  return excelTests.map((tc) => {
    const matched = findBestEndpoint(tc, endpoints);
    if (!matched) {
      // Unmatched: use the Excel endpoint directly with fallback baseUrl
      const base = defaultBaseUrl;
      const rawPath = tc.endpoint || '/unknown';
      return {
        ...tc,
        _unmatched: true,
        rawPath,
        endpoint: rawPath.startsWith('http') ? rawPath : `${base}${rawPath}`,
        baseUrl: base,
      };
    }
    const baseUrl = matched.baseUrl;
    return {
      ...tc,
      endpoint: `${baseUrl}${matched.path}`,
      rawPath: matched.path,
      method: tc.method || matched.method,
      baseUrl,
      responseSchema: getSuccessSchema(matched),
      _matched: matched.path,
    };
  });
}

function findBestEndpoint(tc, endpoints) {
  const target = (tc.endpoint || '').replace(/\/+$/, '').toLowerCase();
  if (!target) return null;

  let best = null;
  let bestScore = 0;

  for (const ep of endpoints) {
    if (tc.method && ep.method !== tc.method) continue;

    const score = similarity(target, ep.path.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      best = ep;
    }
  }
  return bestScore > 0.4 ? best : null;
}

// Levenshtein-ratio-ish similarity
function similarity(a, b) {
  const normA = a.replace(/\{[^}]+\}/g, ':p').replace(/\/\d+/g, '/:p');
  const normB = b.replace(/\{[^}]+\}/g, ':p').replace(/\/\d+/g, '/:p');
  if (normA === normB) return 1;
  const tokensA = normA.split('/').filter(Boolean);
  const tokensB = normB.split('/').filter(Boolean);
  const common = tokensA.filter((t) => tokensB.includes(t)).length;
  const total = Math.max(tokensA.length, tokensB.length) || 1;
  return common / total;
}

function getSuccessSchema(ep) {
  const codes = Object.keys(ep.responses || {});
  const ok = codes.find((c) => c.startsWith('2'));
  return ok ? ep.responses[ok].schema : null;
}

module.exports = { mapTestsToEndpoints };
