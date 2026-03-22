const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'urls.db');
const db = new Database(DB_PATH);

// 테이블 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    original   TEXT    NOT NULL,
    code       TEXT    NOT NULL UNIQUE,
    clicks     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT    -- NULL이면 만료 없음
  );

  CREATE TABLE IF NOT EXISTS click_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    code       TEXT NOT NULL,
    clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip         TEXT,
    user_agent TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_urls_code ON urls(code);
  CREATE INDEX IF NOT EXISTS idx_click_logs_code ON click_logs(code);
`);

// --- URL CRUD ---

/** 새 단축 URL 생성 */
function createUrl({ original, code, expiresAt }) {
  const stmt = db.prepare(`
    INSERT INTO urls (original, code, expires_at)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(original, code, expiresAt || null);
  return getByCode(code);
}

/** 코드로 URL 조회 (만료 포함) */
function getByCode(code) {
  return db.prepare('SELECT * FROM urls WHERE code = ?').get(code) || null;
}

/** 전체 URL 목록 (최신순) */
function listUrls({ limit = 50, offset = 0 } = {}) {
  return db
    .prepare('SELECT * FROM urls ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

/** 클릭 수 증가 + 로그 기록 */
function recordClick({ code, ip, userAgent }) {
  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE code = ?').run(code);
  db.prepare(`
    INSERT INTO click_logs (code, ip, user_agent) VALUES (?, ?, ?)
  `).run(code, ip || null, userAgent || null);
}

/** 최근 클릭 로그 */
function getClickLogs(code, limit = 20) {
  return db
    .prepare(
      'SELECT * FROM click_logs WHERE code = ? ORDER BY id DESC LIMIT ?'
    )
    .all(code, limit);
}

/** 코드 존재 여부 */
function codeExists(code) {
  return !!db.prepare('SELECT 1 FROM urls WHERE code = ?').get(code);
}

module.exports = {
  createUrl,
  getByCode,
  listUrls,
  recordClick,
  getClickLogs,
  codeExists,
};
