const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 미들웨어 ──────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 유틸 ──────────────────────────────────────────────────────────────────────
/** 랜덤 단축 코드 생성 (영소문자 + 숫자, 6자) */
function generateCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** 유효한 URL인지 검사 */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 클라이언트 IP 추출 */
function getIp(req) {
  return (
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

// ── API 라우트 ────────────────────────────────────────────────────────────────

/**
 * POST /api/shorten
 * body: { url, customCode?, expiresInDays? }
 */
app.post('/api/shorten', (req, res) => {
  const { url, customCode, expiresInDays } = req.body || {};

  // 유효성 검사
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL을 입력해주세요.' });
  }
  if (!isValidUrl(url)) {
    return res
      .status(400)
      .json({ error: '유효한 URL(http/https)을 입력해주세요.' });
  }

  // 코드 결정
  let code;
  if (customCode) {
    const cleaned = customCode.trim();
    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(cleaned)) {
      return res.status(400).json({
        error:
          '커스텀 코드는 2~30자의 영문자·숫자·_·- 만 사용할 수 있습니다.',
      });
    }
    if (db.codeExists(cleaned)) {
      return res
        .status(409)
        .json({ error: '이미 사용 중인 커스텀 코드입니다.' });
    }
    code = cleaned;
  } else {
    // 충돌 없는 코드 생성 (최대 10회 시도)
    let attempts = 0;
    do {
      code = generateCode(6);
      attempts++;
      if (attempts > 10) {
        return res
          .status(500)
          .json({ error: '코드 생성에 실패했습니다. 다시 시도해주세요.' });
      }
    } while (db.codeExists(code));
  }

  // 만료일 계산
  let expiresAt = null;
  if (expiresInDays) {
    const days = parseInt(expiresInDays, 10);
    if (isNaN(days) || days < 1 || days > 3650) {
      return res
        .status(400)
        .json({ error: '만료 기간은 1~3650일 사이여야 합니다.' });
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    expiresAt = d.toISOString();
  }

  const record = db.createUrl({ original: url, code, expiresAt });
  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;

  return res.status(201).json({ ...record, shortUrl });
});

/**
 * GET /api/urls
 * 단축 URL 목록 (페이지네이션: ?limit=&offset=)
 */
app.get('/api/urls', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  const urls = db.listUrls({ limit, offset });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const enriched = urls.map((u) => ({
    ...u,
    shortUrl: `${baseUrl}/${u.code}`,
    expired:
      u.expires_at ? new Date(u.expires_at) < new Date() : false,
  }));
  res.json(enriched);
});

/**
 * GET /api/urls/:code
 * 단일 URL 정보 + 최근 클릭 로그
 */
app.get('/api/urls/:code', (req, res) => {
  const record = db.getByCode(req.params.code);
  if (!record) return res.status(404).json({ error: '존재하지 않는 코드입니다.' });

  const logs = db.getClickLogs(req.params.code, 20);
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    ...record,
    shortUrl: `${baseUrl}/${record.code}`,
    expired: record.expires_at
      ? new Date(record.expires_at) < new Date()
      : false,
    recentClicks: logs,
  });
});

// ── 리디렉션 ──────────────────────────────────────────────────────────────────
app.get('/:code', (req, res) => {
  // 정적 파일 / API 경로 충돌 방지
  const { code } = req.params;
  if (!code || code === 'favicon.ico') return res.status(404).end();

  const record = db.getByCode(code);
  if (!record) {
    return res.status(404).send(`
      <!doctype html>
      <html lang="ko">
        <head><meta charset="UTF-8"><title>404 - 없는 링크</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:4rem">
          <h1>🔗 링크를 찾을 수 없습니다</h1>
          <p>코드 <code>${code}</code>에 해당하는 URL이 없습니다.</p>
          <a href="/">홈으로 돌아가기</a>
        </body>
      </html>`);
  }

  // 만료 확인
  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return res.status(410).send(`
      <!doctype html>
      <html lang="ko">
        <head><meta charset="UTF-8"><title>410 - 만료된 링크</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:4rem">
          <h1>⏰ 만료된 링크입니다</h1>
          <p>이 단축 URL은 유효 기간이 지났습니다.</p>
          <a href="/">홈으로 돌아가기</a>
        </body>
      </html>`);
  }

  db.recordClick({
    code,
    ip: getIp(req),
    userAgent: req.headers['user-agent'] || null,
  });

  return res.redirect(301, record.original);
});

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ URL 단축 서비스 실행 중: http://localhost:${PORT}`);
});
