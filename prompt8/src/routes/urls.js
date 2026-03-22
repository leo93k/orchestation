const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../db');

const ALLOWED_SCHEMES = /^https?:\/\//i;
const DANGEROUS_SCHEMES = /^(javascript|data|vbscript|file|ftp):/i;
const CUSTOM_CODE_PATTERN = /^[a-zA-Z0-9]+$/;

function validateUrl(url) {
  if (!url || typeof url !== 'string') return 'URL이 필요합니다.';
  const trimmed = url.trim();
  if (DANGEROUS_SCHEMES.test(trimmed)) return '허용되지 않는 URL 스킴입니다.';
  if (!ALLOWED_SCHEMES.test(trimmed)) return 'http 또는 https URL만 허용됩니다.';
  try { new URL(trimmed); } catch { return '유효하지 않은 URL입니다.'; }
  return null;
}

// POST /api/urls - 단축 URL 생성
router.post('/', (req, res) => {
  const { original_url, custom_code, expires_in_days } = req.body;

  const urlError = validateUrl(original_url);
  if (urlError) return res.status(400).json({ error: urlError });

  let short_code;
  if (custom_code) {
    if (!CUSTOM_CODE_PATTERN.test(custom_code)) {
      return res.status(400).json({ error: '커스텀 코드는 영문자와 숫자만 허용됩니다.' });
    }
    if (custom_code.length < 2 || custom_code.length > 20) {
      return res.status(400).json({ error: '커스텀 코드는 2~20자 이내여야 합니다.' });
    }
    const existing = db.prepare('SELECT id FROM urls WHERE short_code = ?').get(custom_code);
    if (existing) return res.status(409).json({ error: '이미 사용 중인 커스텀 코드입니다.' });
    short_code = custom_code;
  } else {
    short_code = nanoid(6);
    while (db.prepare('SELECT id FROM urls WHERE short_code = ?').get(short_code)) {
      short_code = nanoid(6);
    }
  }

  let expires_at = null;
  if (expires_in_days) {
    const days = parseInt(expires_in_days, 10);
    if (isNaN(days) || days < 1 || days > 3650) {
      return res.status(400).json({ error: '만료 기간은 1~3650일 사이여야 합니다.' });
    }
    const d = new Date();
    d.setDate(d.getDate() + days);
    expires_at = d.toISOString();
  }

  const stmt = db.prepare(
    'INSERT INTO urls (original_url, short_code, expires_at) VALUES (?, ?, ?)'
  );
  const result = stmt.run(original_url.trim(), short_code, expires_at);

  const row = db.prepare('SELECT * FROM urls WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// GET /api/urls - 목록 조회
router.get('/', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM urls ORDER BY created_at DESC LIMIT 100'
  ).all();
  res.json(rows);
});

// GET /api/urls/:code - 단일 조회
router.get('/:code', (req, res) => {
  const row = db.prepare('SELECT * FROM urls WHERE short_code = ?').get(req.params.code);
  if (!row) return res.status(404).json({ error: '존재하지 않는 단축 코드입니다.' });
  res.json(row);
});

// DELETE /api/urls/:code - 삭제
router.delete('/:code', (req, res) => {
  const result = db.prepare('DELETE FROM urls WHERE short_code = ?').run(req.params.code);
  if (result.changes === 0) return res.status(404).json({ error: '존재하지 않는 단축 코드입니다.' });
  res.json({ success: true });
});

module.exports = router;
