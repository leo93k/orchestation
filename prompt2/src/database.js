const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data.db');
const db = new Database(dbPath);

// WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    custom_alias TEXT UNIQUE,
    clicks INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_short_code ON urls(short_code)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_custom_alias ON urls(custom_alias)`);

// Prepared statements
const stmts = {
  insert: db.prepare(`
    INSERT INTO urls (original_url, short_code, custom_alias, expires_at)
    VALUES (@originalUrl, @shortCode, @customAlias, @expiresAt)
  `),
  findByCode: db.prepare(`
    SELECT * FROM urls WHERE short_code = ? OR custom_alias = ?
  `),
  incrementClicks: db.prepare(`
    UPDATE urls SET clicks = clicks + 1 WHERE short_code = ? OR custom_alias = ?
  `),
  listAll: db.prepare(`
    SELECT * FROM urls ORDER BY created_at DESC
  `),
  getStats: db.prepare(`
    SELECT * FROM urls WHERE short_code = ? OR custom_alias = ?
  `),
  deleteById: db.prepare(`
    DELETE FROM urls WHERE id = ?
  `),
  existsByCode: db.prepare(`
    SELECT 1 FROM urls WHERE short_code = ? OR custom_alias = ?
  `),
};

function createUrl(originalUrl, shortCode, customAlias, expiresAt) {
  const result = stmts.insert.run({
    originalUrl,
    shortCode,
    customAlias: customAlias || null,
    expiresAt: expiresAt || null,
  });
  return { id: result.lastInsertRowid, shortCode, customAlias };
}

function findByCode(code) {
  return stmts.findByCode.get(code, code);
}

function incrementClicks(code) {
  stmts.incrementClicks.run(code, code);
}

function listAll() {
  return stmts.listAll.all();
}

function getStats(code) {
  return stmts.getStats.get(code, code);
}

function deleteUrl(id) {
  return stmts.deleteById.run(id);
}

function codeExists(code) {
  return !!stmts.existsByCode.get(code, code);
}

module.exports = {
  db,
  createUrl,
  findByCode,
  incrementClicks,
  listAll,
  getStats,
  deleteUrl,
  codeExists,
};
