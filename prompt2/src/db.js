const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'urls.db');

// 데이터 디렉토리 생성
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL 모드로 성능 향상
db.pragma('journal_mode = WAL');

// 테이블 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,
    original    TEXT    NOT NULL,
    clicks      INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT    -- NULL이면 만료 없음
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    url_code   TEXT    NOT NULL,
    clicked_at TEXT    NOT NULL DEFAULT (datetime('now')),
    referrer   TEXT,
    user_agent TEXT,
    FOREIGN KEY (url_code) REFERENCES urls(code)
  );

  CREATE INDEX IF NOT EXISTS idx_urls_code ON urls(code);
  CREATE INDEX IF NOT EXISTS idx_clicks_url_code ON clicks(url_code);
`);

// ── URL CRUD ──────────────────────────────────────────────

/**
 * 단축 URL 생성
 */
function createUrl({ code, original, expiresInDays }) {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const stmt = db.prepare(`
    INSERT INTO urls (code, original, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(code, original, expiresAt);
  return getUrlByCode(code);
}

/**
 * 코드로 URL 조회
 */
function getUrlByCode(code) {
  return db.prepare('SELECT * FROM urls WHERE code = ?').get(code);
}

/**
 * 전체 URL 목록 (최신순)
 */
function getAllUrls() {
  return db.prepare('SELECT * FROM urls ORDER BY created_at DESC').all();
}

/**
 * 클릭 수 증가 + 클릭 로그 저장
 */
function recordClick({ code, referrer, userAgent }) {
  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE code = ?').run(code);
  db.prepare(`
    INSERT INTO clicks (url_code, referrer, user_agent)
    VALUES (?, ?, ?)
  `).run(code, referrer || null, userAgent || null);
}

/**
 * 특정 URL의 일별 클릭 통계 (최근 30일)
 */
function getClickStats(code) {
  return db.prepare(`
    SELECT date(clicked_at) AS day, COUNT(*) AS count
    FROM   clicks
    WHERE  url_code = ?
      AND  clicked_at >= datetime('now', '-30 days')
    GROUP  BY day
    ORDER  BY day ASC
  `).all(code);
}

/**
 * 만료된 URL 삭제 (정리용)
 */
function deleteExpiredUrls() {
  return db.prepare(`
    DELETE FROM urls
    WHERE expires_at IS NOT NULL
      AND expires_at < datetime('now')
  `).run().changes;
}

module.exports = {
  createUrl,
  getUrlByCode,
  getAllUrls,
  recordClick,
  getClickStats,
  deleteExpiredUrls,
};
