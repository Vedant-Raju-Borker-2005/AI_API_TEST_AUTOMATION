
class MockStatement {
  constructor(sql, db) {
    this.sql = sql;
    this.db = db;
  }
  run(...args) {
    const tableName = this.sql.match(/INSERT INTO (\w+)/i)?.[1];
    if (tableName) {
      if (!this.db.memory[tableName]) this.db.memory[tableName] = [];
      this.db.memory[tableName].push(args);
    }
    return { changes: 1, lastInsertRowid: Date.now() };
  }
  get(...args) {
    if (this.sql.toUpperCase().includes('COUNT(*)')) {
      return { c: 0 }; // Always assume empty for counts in mock
    }
    const tableName = this.sql.match(/FROM (\w+)/i)?.[1];
    if (tableName && this.db.memory[tableName]) {
        const row = this.db.memory[tableName][0];
        return this.mapToObj(tableName, row);
    }
    return null;
  }
  all(...args) {
    const tableName = this.sql.match(/FROM (\w+)/i)?.[1];
    if (tableName && this.db.memory[tableName]) {
        return this.db.memory[tableName].map(row => this.mapToObj(tableName, row));
    }
    return [];
  }

  mapToObj(tableName, row) {
    if (!row) return null;
    if (tableName === 'test_runs') {
        return { id: row[0], spec_name: row[1], created_at: row[2], total: row[3], passed: row[4], failed: row[5], avg_response_time: row[6], summary: row[7] };
    }
    if (tableName === 'environments') {
        return { name: row[0], base_url: row[1], auth_type: row[2], auth_config: row[3], variables: row[4], created_at: row[5] };
    }
    if (tableName === 'endpoint_history') {
        return { endpoint: row[0], method: row[1], failures: row[2], runs: row[3], avg_response_time: row[4], last_updated: row[5] };
    }
    return row;
  }
}

class MockDatabase {
  constructor(path) {
    console.log('Using In-Memory Mock Database at', path);
    this.memory = {};
  }
  exec(sql) {
    return this;
  }
  prepare(sql) {
    return new MockStatement(sql, this);
  }
}

module.exports = MockDatabase;
