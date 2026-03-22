const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'urls.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS click_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    clicked_at TEXT DEFAULT (datetime('now')),
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (slug) REFERENCES urls(slug) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_urls_slug ON urls(slug);
  CREATE INDEX IF NOT EXISTS idx_click_log_slug ON click_log(slug);
`);

const stmts = {
  insertUrl: db.prepare(
    'INSERT INTO urls (slug, original_url, expires_at) VALUES (@slug, @originalUrl, @expiresAt)'
  ),
  getUrl: db.prepare('SELECT * FROM urls WHERE slug = ?'),
  getAllUrls: db.prepare('SELECT * FROM urls ORDER BY created_at DESC'),
  incrementClick: db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE slug = ?'),
  logClick: db.prepare(
    'INSERT INTO click_log (slug, ip, user_agent) VALUES (@slug, @ip, @userAgent)'
  ),
  deleteUrl: db.prepare('DELETE FROM urls WHERE slug = ?'),
  getClickStats: db.prepare(
    `SELECT date(clicked_at) AS date, COUNT(*) AS count
     FROM click_log
     WHERE slug = ?
     GROUP BY date(clicked_at)
     ORDER BY date(clicked_at) DESC`
  ),
};

function createUrl({ slug, originalUrl, expiresAt }) {
  stmts.insertUrl.run({ slug, originalUrl, expiresAt });
  return stmts.getUrl.get(slug);
}

function getUrl(slug) {
  return stmts.getUrl.get(slug);
}

function getAllUrls() {
  return stmts.getAllUrls.all();
}

function incrementClick(slug) {
  stmts.incrementClick.run(slug);
}

function logClick({ slug, ip, userAgent }) {
  stmts.logClick.run({ slug, ip, userAgent });
}

function deleteUrl(slug) {
  const result = stmts.deleteUrl.run(slug);
  return result.changes > 0;
}

function getClickStats(slug) {
  return stmts.getClickStats.all(slug);
}

module.exports = {
  db,
  createUrl,
  getUrl,
  getAllUrls,
  incrementClick,
  logClick,
  deleteUrl,
  getClickStats,
};
