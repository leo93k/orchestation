import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'data', 'urls.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    UNIQUE NOT NULL,
    original_url TEXT   NOT NULL,
    is_custom   INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    created_at  TEXT    DEFAULT (datetime('now')),
    expires_at  TEXT,
    last_clicked_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_urls_code ON urls(code);
  CREATE INDEX IF NOT EXISTS idx_urls_expires ON urls(expires_at) WHERE expires_at IS NOT NULL;

  CREATE TABLE IF NOT EXISTS click_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id      INTEGER NOT NULL,
    clicked_at  TEXT    DEFAULT (datetime('now')),
    ip_address  TEXT,
    user_agent  TEXT,
    referer     TEXT,
    FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON click_logs(url_id);
  CREATE INDEX IF NOT EXISTS idx_clicks_at ON click_logs(clicked_at);
`);

// Prepared statements for performance
export const stmts = {
  findByCode: db.prepare(`
    SELECT * FROM urls
    WHERE code = ?
      AND (expires_at IS NULL OR expires_at > datetime('now'))
  `),

  findByCodeAny: db.prepare(`SELECT * FROM urls WHERE code = ?`),

  create: db.prepare(`
    INSERT INTO urls (code, original_url, is_custom, expires_at)
    VALUES (@code, @original_url, @is_custom, @expires_at)
  `),

  incrementClick: db.prepare(`
    UPDATE urls
    SET click_count = click_count + 1,
        last_clicked_at = datetime('now')
    WHERE code = ?
  `),

  logClick: db.prepare(`
    INSERT INTO click_logs (url_id, ip_address, user_agent, referer)
    VALUES (@url_id, @ip_address, @user_agent, @referer)
  `),

  listAll: db.prepare(`
    SELECT id, code, original_url, is_custom, click_count,
           created_at, expires_at, last_clicked_at,
           CASE
             WHEN expires_at IS NULL THEN 'active'
             WHEN expires_at <= datetime('now') THEN 'expired'
             ELSE 'active'
           END AS status
    FROM urls
    ORDER BY created_at DESC
    LIMIT 100
  `),

  deleteByCode: db.prepare(`DELETE FROM urls WHERE code = ?`),

  getClickLogs: db.prepare(`
    SELECT clicked_at, ip_address, user_agent, referer
    FROM click_logs
    WHERE url_id = ?
    ORDER BY clicked_at DESC
    LIMIT 50
  `),

  getClicksByDay: db.prepare(`
    SELECT date(clicked_at) AS day, COUNT(*) AS count
    FROM click_logs
    WHERE url_id = ?
      AND clicked_at >= datetime('now', '-30 days')
    GROUP BY day
    ORDER BY day ASC
  `),
};

// Transactional click recording
export const recordClick = db.transaction((code, meta) => {
  stmts.incrementClick.run(code);
  const url = stmts.findByCodeAny.get(code);
  if (url) {
    stmts.logClick.run({
      url_id: url.id,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
      referer: meta.referer,
    });
  }
});

export default db;
