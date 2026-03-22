const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'urls.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    click_count INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);

module.exports = db;
