const express = require('express');
const path = require('path');
const { createUrl, getUrl, getAllUrls, recordClick, isExpired, deleteExpired } = require('./db');
const { generateCode } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 매 요청 시 만료된 URL 삭제
app.use((req, res, next) => {
  deleteExpired();
  next();
});

// POST /api/shorten - URL 단축
app.post('/api/shorten', (req, res) => {
  let { url, customCode, expiresIn } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  // URL 유효성 검사: http:// 또는 https://로 시작하지 않으면 https:// 자동 추가
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // 코드 결정
  let code;
  if (customCode) {
    const existing = getUrl(customCode);
    if (existing && !isExpired(existing)) {
      return res.status(409).json({ error: 'Custom code already in use' });
    }
    code = customCode;
  } else {
    code = generateCode();
  }

  // 만료 시간 계산
  const expiresAt = expiresIn ? Date.now() + expiresIn * 60000 : null;

  const entry = createUrl(code, url, expiresAt);

  res.status(201).json({
    shortUrl: `http://localhost:${PORT}/${code}`,
    code: entry.code,
    originalUrl: entry.originalUrl,
    expiresAt: entry.expiresAt,
  });
});

// GET /api/urls - 전체 URL 목록 (만료 제외)
app.get('/api/urls', (req, res) => {
  const entries = getAllUrls().filter((entry) => !isExpired(entry));
  res.json(entries);
});

// GET /api/urls/:code/stats - 특정 URL 통계
app.get('/api/urls/:code/stats', (req, res) => {
  const entry = getUrl(req.params.code);
  if (!entry || isExpired(entry)) {
    return res.status(404).json({ error: 'URL not found or expired' });
  }
  res.json(entry);
});

// GET /:code - 리다이렉트 (API 라우트 뒤에 배치)
app.get('/:code', (req, res) => {
  const entry = getUrl(req.params.code);
  if (!entry || isExpired(entry)) {
    return res.status(404).send('URL not found or expired');
  }
  recordClick(req.params.code, req.headers['user-agent'], req.ip);
  res.redirect(302, entry.originalUrl);
});

app.listen(PORT, () => {
  console.log(`URL Shortener running on http://localhost:${PORT}`);
});
