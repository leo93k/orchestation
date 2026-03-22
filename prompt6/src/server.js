const express = require('express');
const Database = require('better-sqlite3');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'urls.db'));

// DB 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    expires_at TEXT
  )
`);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 만료 URL 자동 정리 (요청마다)
function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// HTML UI
app.get('/', (req, res) => {
  const urls = db.prepare(`SELECT * FROM urls ORDER BY id DESC LIMIT 100`).all();

  const rows = urls.map(u => {
    const expired = isExpired(u.expires_at);
    const shortUrl = `${req.protocol}://${req.get('host')}/${u.code}`;
    return `
      <tr class="${expired ? 'expired' : ''}">
        <td><a href="${shortUrl}" target="_blank">${shortUrl}</a>${expired ? ' <span class="badge">만료됨</span>' : ''}</td>
        <td class="original" title="${u.original_url}">${u.original_url.length > 50 ? u.original_url.slice(0, 50) + '...' : u.original_url}</td>
        <td class="center">${u.clicks}</td>
        <td class="center">${u.expires_at || '없음'}</td>
        <td class="center">${u.created_at}</td>
        <td class="center">
          <button onclick="copyUrl('${shortUrl}')" class="btn-copy">복사</button>
          <button onclick="deleteUrl('${u.code}')" class="btn-del">삭제</button>
        </td>
      </tr>`;
  }).join('');

  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URL 단축 서비스</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f0f4f8; color: #2d3748; }
    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 24px; text-align: center; color: white; }
    .hero h1 { font-size: 2.4rem; font-weight: 700; margin-bottom: 8px; }
    .hero p { font-size: 1.1rem; opacity: 0.85; }
    .container { max-width: 1100px; margin: 0 auto; padding: 32px 16px; }
    .card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); margin-bottom: 32px; }
    .card h2 { font-size: 1.2rem; font-weight: 600; margin-bottom: 20px; color: #4a5568; }
    .form-grid { display: grid; grid-template-columns: 1fr 200px 200px; gap: 12px; align-items: end; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 0.85rem; font-weight: 500; color: #718096; }
    input { border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 0.95rem; transition: border-color .2s; outline: none; }
    input:focus { border-color: #667eea; }
    .btn { padding: 10px 24px; border: none; border-radius: 8px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all .2s; }
    .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; width: 100%; }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .result { margin-top: 20px; padding: 16px; background: #f0fff4; border: 1.5px solid #9ae6b4; border-radius: 10px; display: none; }
    .result-url { font-size: 1.1rem; font-weight: 600; color: #276749; word-break: break-all; }
    .result-actions { margin-top: 10px; display: flex; gap: 8px; }
    .btn-sm { padding: 6px 14px; font-size: 0.82rem; border-radius: 6px; border: none; cursor: pointer; font-weight: 500; }
    .btn-copy { background: #667eea; color: white; }
    .btn-del { background: #fc8181; color: white; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th { background: #f7fafc; padding: 12px 14px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 2px solid #e2e8f0; }
    td { padding: 12px 14px; border-bottom: 1px solid #edf2f7; vertical-align: middle; }
    tr:hover td { background: #f7fafc; }
    tr.expired td { opacity: 0.45; }
    .badge { font-size: 0.7rem; background: #fed7d7; color: #9b2c2c; padding: 2px 7px; border-radius: 99px; font-weight: 600; }
    .center { text-align: center; }
    .original { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .stat-num { font-size: 2rem; font-weight: 700; color: #667eea; }
    .stat-label { font-size: 0.85rem; color: #718096; margin-top: 4px; }
    .toast { position: fixed; bottom: 24px; right: 24px; background: #2d3748; color: white; padding: 12px 20px; border-radius: 8px; font-size: 0.9rem; display: none; z-index: 999; }
    @media (max-width: 700px) {
      .form-grid { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="hero">
    <h1>🔗 URL 단축 서비스</h1>
    <p>긴 URL을 짧고 기억하기 쉬운 링크로 변환하세요</p>
  </div>

  <div class="container">
    <div class="stats">
      <div class="stat-card">
        <div class="stat-num">${urls.length}</div>
        <div class="stat-label">총 단축 URL</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${urls.reduce((s, u) => s + u.clicks, 0)}</div>
        <div class="stat-label">총 클릭 수</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${urls.filter(u => !isExpired(u.expires_at)).length}</div>
        <div class="stat-label">활성 URL</div>
      </div>
    </div>

    <div class="card">
      <h2>✂️ URL 단축하기</h2>
      <div class="form-grid">
        <div class="form-group">
          <label>원본 URL *</label>
          <input type="url" id="originalUrl" placeholder="https://example.com/very/long/url" />
        </div>
        <div class="form-group">
          <label>커스텀 코드 (선택)</label>
          <input type="text" id="customCode" placeholder="my-link" maxlength="30" />
        </div>
        <div class="form-group">
          <label>만료 기간 (선택)</label>
          <input type="datetime-local" id="expiresAt" />
        </div>
      </div>
      <div style="margin-top:14px;">
        <button class="btn btn-primary" onclick="shorten()">단축 URL 생성</button>
      </div>
      <div class="result" id="result">
        <div class="result-url" id="resultUrl"></div>
        <div class="result-actions">
          <button class="btn-sm btn-copy" onclick="copyUrl(document.getElementById('resultUrl').textContent)">📋 복사</button>
          <a id="resultLink" href="#" target="_blank"><button class="btn-sm" style="background:#68d391;color:white;">🔗 열기</button></a>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>📋 단축 URL 목록</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>단축 URL</th>
              <th>원본 URL</th>
              <th class="center">클릭</th>
              <th class="center">만료일</th>
              <th class="center">생성일</th>
              <th class="center">관리</th>
            </tr>
          </thead>
          <tbody id="urlTable">
            ${rows || '<tr><td colspan="6" style="text-align:center;padding:32px;color:#a0aec0;">아직 단축된 URL이 없습니다</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="toast" id="toast"></div>

  <script>
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.style.display = 'block';
      setTimeout(() => t.style.display = 'none', 2500);
    }

    function copyUrl(url) {
      navigator.clipboard.writeText(url).then(() => showToast('✅ 복사되었습니다!'));
    }

    async function shorten() {
      const url = document.getElementById('originalUrl').value.trim();
      const code = document.getElementById('customCode').value.trim();
      const expires = document.getElementById('expiresAt').value;
      if (!url) { showToast('⚠️ URL을 입력하세요'); return; }
      try {
        const res = await fetch('/api/shorten', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, code: code || undefined, expiresAt: expires || undefined })
        });
        const data = await res.json();
        if (!res.ok) { showToast('❌ ' + data.error); return; }
        const el = document.getElementById('result');
        document.getElementById('resultUrl').textContent = data.shortUrl;
        document.getElementById('resultLink').href = data.shortUrl;
        el.style.display = 'block';
        showToast('🎉 단축 URL이 생성되었습니다!');
        setTimeout(() => location.reload(), 1500);
      } catch(e) { showToast('❌ 오류가 발생했습니다'); }
    }

    async function deleteUrl(code) {
      if (!confirm('이 URL을 삭제할까요?')) return;
      const res = await fetch('/api/urls/' + code, { method: 'DELETE' });
      if (res.ok) { showToast('🗑️ 삭제되었습니다'); setTimeout(() => location.reload(), 800); }
      else showToast('❌ 삭제 실패');
    }
  </script>
</body>
</html>`);
});

// URL 단축 API
app.post('/api/shorten', (req, res) => {
  const { url, code, expiresAt } = req.body;
  if (!url) return res.status(400).json({ error: 'URL이 필요합니다' });

  try { new URL(url); } catch { return res.status(400).json({ error: '유효하지 않은 URL입니다' }); }

  const shortCode = code || nanoid(6);

  // 커스텀 코드 중복 체크
  if (code) {
    const exists = db.prepare('SELECT id FROM urls WHERE code = ?').get(code);
    if (exists) return res.status(409).json({ error: '이미 사용 중인 코드입니다' });
  }

  try {
    db.prepare('INSERT INTO urls (code, original_url, expires_at) VALUES (?, ?, ?)').run(shortCode, url, expiresAt || null);
    const shortUrl = `${req.protocol}://${req.get('host')}/${shortCode}`;
    res.json({ shortUrl, code: shortCode });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: '코드 충돌, 다시 시도하세요' });
    res.status(500).json({ error: '서버 오류' });
  }
});

// URL 목록 API
app.get('/api/urls', (req, res) => {
  const urls = db.prepare('SELECT * FROM urls ORDER BY id DESC').all();
  res.json(urls);
});

// URL 삭제 API
app.delete('/api/urls/:code', (req, res) => {
  const result = db.prepare('DELETE FROM urls WHERE code = ?').run(req.params.code);
  if (result.changes === 0) return res.status(404).json({ error: '없음' });
  res.json({ ok: true });
});

// 리디렉션
app.get('/:code', (req, res) => {
  const { code } = req.params;
  const row = db.prepare('SELECT * FROM urls WHERE code = ?').get(code);
  if (!row) return res.status(404).send('<h2>존재하지 않는 단축 URL입니다</h2><a href="/">홈으로</a>');
  if (isExpired(row.expires_at)) return res.status(410).send('<h2>만료된 URL입니다</h2><a href="/">홈으로</a>');
  db.prepare('UPDATE urls SET clicks = clicks + 1 WHERE code = ?').run(code);
  res.redirect(301, row.original_url);
});

app.listen(PORT, () => console.log(`✅ URL 단축 서비스 실행 중 → http://localhost:${PORT}`));
