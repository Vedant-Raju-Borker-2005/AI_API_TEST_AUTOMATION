let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.warn('⚠️ Failed to load better-sqlite3, falling back to mock database.');
  Database = require('./mock-sqlite');
}
const path = require('path');

const db = new Database(path.join(__dirname, '../../test_history.db'));


function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      spec_name TEXT,
      created_at INTEGER,
      total INTEGER,
      passed INTEGER,
      failed INTEGER,
      avg_response_time REAL,
      summary TEXT
    );
    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      run_id TEXT,
      test_name TEXT,
      endpoint TEXT,
      method TEXT,
      category TEXT,
      status TEXT,
      status_code INTEGER,
      response_time REAL,
      priority TEXT,
      priority_score REAL,
      risk_score REAL,
      anomaly INTEGER DEFAULT 0,
      error TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS endpoint_history (
      endpoint TEXT,
      method TEXT,
      failures INTEGER DEFAULT 0,
      runs INTEGER DEFAULT 0,
      avg_response_time REAL DEFAULT 0,
      last_updated INTEGER,
      PRIMARY KEY (endpoint, method)
    );
  `);
  console.log('✅ Database initialized');
}

module.exports = { db, initDB };
