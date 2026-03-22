const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'urls.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    custom_alias INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_short_code ON urls(short_code);
  CREATE INDEX IF NOT EXISTS idx_expires_at ON urls(expires_at);
`);

module.exports = db;
