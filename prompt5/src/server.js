const express = require('express');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// DB 초기화
const db = new Database(path.join(__dirname, 'urls.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    custom_code INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API ───────────────────────────────────────────────────────────────────

// URL 단축 생성
app.post('/api/shorten', (req, res) => {
  const { url, custom_code, expires_in_days } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL이 필요합니다.' });
  }

  // URL 형식 기본 검증
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: '유효하지 않은 URL입니다.' });
  }

  const code = custom_code ? custom_code.trim() : nanoid(6);

  if (!code) {
    return res.status(400).json({ error: '커스텀 코드가 비어 있습니다.' });
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    return res.status(400).json({ error: '커스텀 코드는 영문, 숫자, _, - 만 사용 가능합니다.' });
  }

  const expires_at = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  try {
    const stmt = db.prepare(`
      INSERT INTO urls (original_url, short_code, custom_code, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(url, code, custom_code ? 1 : 0, expires_at);

    const created = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(code);
    res.status(201).json(toPublic(created, req));
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: '이미 사용 중인 코드입니다.' });
    }
    console.error(err);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// URL 목록 조회
app.get('/api/urls', (req, res) => {
  const rows = db.prepare('SELECT * FROM urls ORDER BY created_at DESC').all();
  res.json(rows.map(r => toPublic(r, req)));
});

// 개별 URL 통계
app.get('/api/stats/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(req.params.code);
  if (!row) return res.status(404).json({ error: '존재하지 않는 코드입니다.' });
  res.json(toPublic(row, req));
});

// URL 삭제
app.delete('/api/urls/:code', (req, res) => {
  const result = db.prepare('DELETE FROM urls WHERE short_code = ?').run(req.params.code);
  if (result.changes === 0) return res.status(404).json({ error: '존재하지 않는 코드입니다.' });
  res.json({ message: '삭제되었습니다.' });
});

// ─── 리디렉션 ──────────────────────────────────────────────────────────────

app.get('/:code', (req, res) => {
  const { code } = req.params;

  // 정적 파일 요청 무시
  if (code === 'favicon.ico') return res.sendStatus(204);

  const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(code);

  if (!row) {
    return res.status(404).send(`
      <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
      <title>404 Not Found</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa}
      .box{text-align:center}.btn{display:inline-block;margin-top:16px;padding:10px 24px;background:#6c47ff;color:#fff;border-radius:8px;text-decoration:none}</style>
      </head><body><div class="box"><h1>404</h1><p>존재하지 않거나 만료된 URL입니다.</p>
      <a class="btn" href="/">홈으로</a></div></body></html>
    `);
  }

  // 만료 확인
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return res.status(410).send(`
      <!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
      <title>만료됨</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8f9fa}
      .box{text-align:center}.btn{display:inline-block;margin-top:16px;padding:10px 24px;background:#6c47ff;color:#fff;border-radius:8px;text-decoration:none}</style>
      </head><body><div class="box"><h1>만료된 링크</h1><p>이 단축 URL은 만료되었습니다.</p>
      <a class="btn" href="/">홈으로</a></div></body></html>
    `);
  }

  // 클릭 수 증가
  db.prepare('UPDATE urls SET click_count = click_count + 1 WHERE short_code = ?').run(code);

  res.redirect(302, row.original_url);
});

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────

function toPublic(row, req) {
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    id: row.id,
    original_url: row.original_url,
    short_code: row.short_code,
    short_url: `${base}/${row.short_code}`,
    custom_code: row.custom_code === 1,
    click_count: row.click_count,
    created_at: row.created_at,
    expires_at: row.expires_at || null,
    expired: row.expires_at ? new Date(row.expires_at) < new Date() : false
  };
}

// ─── 서버 시작 ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`URL Shortener 서버 실행 중 → http://localhost:${PORT}`);
});
