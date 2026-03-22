const express = require('express');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT; // 환경변수 필수 — 하드코딩 없음

if (!PORT) {
  console.error('[ERROR] 환경변수 PORT가 설정되지 않았습니다.');
  console.error('  예시: PORT=3000 node server.js');
  process.exit(1);
}

// ── 미들웨어 ──────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── 유틸리티 ─────────────────────────────────────────────

/** 6자리 랜덤 alphanumeric 코드 생성 */
function generateCode(length = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** URL 유효성 검사 */
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** 만료 여부 확인 */
function isExpired(url) {
  if (!url.expires_at) return false;
  return new Date(url.expires_at) < new Date();
}

// ── API 라우트 ────────────────────────────────────────────

/**
 * POST /api/shorten
 * body: { url, customCode?, expiresInDays? }
 */
app.post('/api/shorten', (req, res) => {
  const { url, customCode, expiresInDays } = req.body;

  // URL 검증
  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: '유효한 URL을 입력해주세요. (http:// 또는 https:// 필요)' });
  }

  // 만료일 검증
  const days = expiresInDays ? parseInt(expiresInDays, 10) : null;
  if (expiresInDays !== undefined && expiresInDays !== '' && (isNaN(days) || days < 1 || days > 3650)) {
    return res.status(400).json({ error: '만료일은 1~3650일 사이여야 합니다.' });
  }

  // 코드 결정
  let code = customCode ? customCode.trim() : null;

  if (code) {
    // 커스텀 코드 유효성 검사
    if (!/^[a-zA-Z0-9_-]{1,30}$/.test(code)) {
      return res.status(400).json({ error: '커스텀 코드는 영문/숫자/- /_ 만 사용 가능하며 최대 30자입니다.' });
    }
    // 중복 체크
    if (db.getUrlByCode(code)) {
      return res.status(409).json({ error: `커스텀 코드 "${code}"는 이미 사용 중입니다.` });
    }
  } else {
    // 충돌 없는 코드 자동 생성
    let attempts = 0;
    do {
      code = generateCode(6);
      attempts++;
      if (attempts > 20) {
        return res.status(500).json({ error: '코드 생성 실패. 잠시 후 다시 시도해주세요.' });
      }
    } while (db.getUrlByCode(code));
  }

  const created = db.createUrl({ code, original: url, expiresInDays: days });
  res.status(201).json(formatUrl(created, req));
});

/**
 * GET /api/urls
 * 전체 단축 URL 목록 반환
 */
app.get('/api/urls', (req, res) => {
  const urls = db.getAllUrls().map(u => formatUrl(u, req));
  res.json(urls);
});

/**
 * GET /api/stats/:code
 * 특정 URL 통계 (일별 클릭)
 */
app.get('/api/stats/:code', (req, res) => {
  const { code } = req.params;
  const url = db.getUrlByCode(code);
  if (!url) return res.status(404).json({ error: '존재하지 않는 코드입니다.' });

  const stats = db.getClickStats(code);
  res.json({ ...formatUrl(url, req), dailyClicks: stats });
});

/**
 * GET /:code
 * 원래 URL로 리디렉션
 */
app.get('/:code', (req, res) => {
  const { code } = req.params;

  // 정적 파일이나 API 경로 오탐 방지
  if (code.startsWith('api')) return res.status(404).send('Not found');

  const url = db.getUrlByCode(code);

  if (!url) {
    return res.status(404).send(notFoundHtml(code));
  }

  if (isExpired(url)) {
    return res.status(410).send(expiredHtml(url));
  }

  // 클릭 기록
  db.recordClick({
    code,
    referrer:  req.get('Referer'),
    userAgent: req.get('User-Agent'),
  });

  res.redirect(302, url.original);
});

// ── 헬퍼 ─────────────────────────────────────────────────

function formatUrl(url, req) {
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    code:       url.code,
    original:   url.original,
    shortUrl:   `${base}/${url.code}`,
    clicks:     url.clicks,
    createdAt:  url.created_at,
    expiresAt:  url.expires_at,
    expired:    isExpired(url),
  };
}

function notFoundHtml(code) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>404 - 찾을 수 없음</title>
<style>body{font-family:sans-serif;text-align:center;padding:80px;background:#f8fafc}
h1{color:#ef4444}a{color:#6366f1}</style></head>
<body><h1>404</h1><p>코드 <b>${code}</b>에 해당하는 URL이 없습니다.</p>
<a href="/">← 홈으로</a></body></html>`;
}

function expiredHtml(url) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>만료된 링크</title>
<style>body{font-family:sans-serif;text-align:center;padding:80px;background:#f8fafc}
h1{color:#f59e0b}a{color:#6366f1}</style></head>
<body><h1>링크 만료</h1>
<p>이 단축 URL은 <b>${url.expires_at?.slice(0,10)}</b>에 만료되었습니다.</p>
<a href="/">← 홈으로</a></body></html>`;
}

// ── 주기적 만료 URL 정리 (1시간마다) ────────────────────
setInterval(() => {
  const removed = db.deleteExpiredUrls();
  if (removed > 0) console.log(`[Cleanup] 만료된 URL ${removed}건 삭제`);
}, 60 * 60 * 1000);

// ── 서버 시작 ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ URL 단축 서비스 실행 중: http://localhost:${PORT}`);
});
