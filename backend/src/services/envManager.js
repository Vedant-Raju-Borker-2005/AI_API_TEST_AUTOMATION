/**
 * Manages multiple environments (dev/staging/prod).
 * Environments live in-memory (backed by SQLite for persistence).
 */
const { db } = require('../db/database');

db.exec(`
  CREATE TABLE IF NOT EXISTS environments (
    name TEXT PRIMARY KEY,
    base_url TEXT,
    auth_type TEXT,
    auth_config TEXT,
    variables TEXT,
    created_at INTEGER
  )
`);

// Seed default environments on first run
function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM environments').get().c;
  if (count === 0) {
    const stmt = db.prepare(
      'INSERT INTO environments VALUES (?, ?, ?, ?, ?, ?)'
    );
    const now = Date.now();
    stmt.run('dev', 'http://localhost:3000', 'none', '{}', '{}', now);
    stmt.run('staging', 'https://staging.example.com', 'jwt', '{}', '{}', now);
    stmt.run('prod', 'https://api.example.com', 'apiKey', '{}', '{}', now);
  }
}
seedDefaults();

function listEnvironments() {
  return db.prepare('SELECT * FROM environments ORDER BY name').all().map(parseRow);
}

function getEnvironment(name) {
  const row = db.prepare('SELECT * FROM environments WHERE name = ?').get(name);
  return row ? parseRow(row) : null;
}

function upsertEnvironment(env) {
  db.prepare(`
    INSERT INTO environments (name, base_url, auth_type, auth_config, variables, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      base_url = excluded.base_url,
      auth_type = excluded.auth_type,
      auth_config = excluded.auth_config,
      variables = excluded.variables
  `).run(
    env.name,
    env.baseUrl || '',
    env.authType || 'none',
    JSON.stringify(env.authConfig || {}),
    JSON.stringify(env.variables || {}),
    Date.now()
  );
  return getEnvironment(env.name);
}

function parseRow(r) {
  return {
    name: r.name,
    baseUrl: r.base_url,
    authType: r.auth_type,
    authConfig: safeJSON(r.auth_config),
    variables: safeJSON(r.variables),
  };
}
function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

/**
 * Apply environment to a list of tests — overrides baseUrl + injects variables.
 */
function applyEnvironment(tests, envName) {
  const env = getEnvironment(envName);
  if (!env) return { tests, auth: { type: 'none' } };

  const rebuilt = tests.map((t) => {
    const newBase = env.baseUrl;
    const newEndpoint = t.rawPath ? `${newBase}${t.rawPath}` : t.endpoint;
    return { ...t, endpoint: newEndpoint, baseUrl: newBase };
  });

  return {
    tests: rebuilt,
    auth: { type: env.authType, ...env.authConfig },
    variables: env.variables,
  };
}

module.exports = { listEnvironments, getEnvironment, upsertEnvironment, applyEnvironment };
