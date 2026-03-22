const express = require('express');
const { nanoid } = require('nanoid');
const store = require('./store');

const router = express.Router();

// ──────────────────────────────────────────────
// POST /api/shorten  →  URL 단축 생성
// ──────────────────────────────────────────────
router.post('/api/shorten', (req, res) => {
  const { originalUrl, customCode, expiresInDays } = req.body;

  // 필수 값 검증
  if (!originalUrl) {
    return res.status(400).json({ error: 'originalUrl is required' });
  }

  // URL 형식 검증
  try {
    new URL(originalUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // 커스텀 코드 or 자동 생성 (6자리)
  const shortCode = customCode ? customCode.trim() : nanoid(6);

  // 커스텀 코드 중복 확인
  if (customCode && store.has(shortCode)) {
    return res.status(409).json({ error: `Custom code "${shortCode}" is already in use` });
  }

  // 만료 시간 계산
  let expiresAt = null;
  if (expiresInDays && Number(expiresInDays) > 0) {
    expiresAt = Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000;
  }

  const entry = {
    shortCode,
    originalUrl,
    clicks: 0,
    createdAt: Date.now(),
    expiresAt,
  };

  store.set(shortCode, entry);

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return res.status(201).json({
    shortCode,
    shortUrl: `${baseUrl}/${shortCode}`,
    originalUrl,
    expiresAt,
  });
});

// ──────────────────────────────────────────────
// GET /api/urls  →  전체 단축 URL 목록 + 통계
// ──────────────────────────────────────────────
router.get('/api/urls', (_req, res) => {
  const list = store.getAll().sort((a, b) => b.createdAt - a.createdAt);
  return res.json(list);
});

// ──────────────────────────────────────────────
// GET /api/urls/:code  →  단일 항목 조회
// ──────────────────────────────────────────────
router.get('/api/urls/:code', (req, res) => {
  const entry = store.get(req.params.code);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  return res.json({
    ...entry,
    expired: entry.expiresAt ? Date.now() > entry.expiresAt : false,
  });
});

module.exports = router;
