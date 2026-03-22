const express = require('express');
const path = require('path');
const store = require('./store');
const apiRoutes = require('./routes');

const app = express();

// ── 포트는 반드시 환경변수(PORT)로 받는다 ──
const PORT = process.env.PORT;
if (!PORT) {
  console.error('[server] ERROR: PORT environment variable is required.');
  process.exit(1);
}

// ── 미들웨어 ──
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── API 라우트 ──
app.use(apiRoutes);

// ── 리디렉션: /:code ──
app.get('/:code', (req, res) => {
  const { code } = req.params;

  // 정적 파일 경로와 충돌 방지 (favicon, etc.)
  if (code === 'favicon.ico') return res.sendStatus(204);

  const entry = store.get(code);

  if (!entry) {
    return res.status(404).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h1>404</h1><p>단축 URL을 찾을 수 없습니다.</p>
        <a href="/">홈으로 돌아가기</a>
      </body></html>
    `);
  }

  // 만료 확인
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    return res.status(410).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:4rem">
        <h1>410</h1><p>이 단축 URL은 만료되었습니다.</p>
        <a href="/">홈으로 돌아가기</a>
      </body></html>
    `);
  }

  // 클릭 수 증가 후 리디렉션
  store.incrementClicks(code);
  return res.redirect(301, entry.originalUrl);
});

// ── 만료 항목 주기적 정리 (1시간마다) ──
setInterval(() => {
  const purged = store.purgeExpired();
  if (purged > 0) console.log(`[store] Purged ${purged} expired URL(s)`);
}, 60 * 60 * 1000);

// ── 서버 시작 ──
app.listen(PORT, () => {
  console.log(`[server] URL Shortener running on http://localhost:${PORT}`);
});
