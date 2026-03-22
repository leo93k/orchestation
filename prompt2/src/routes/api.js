const express = require('express');
const router = express.Router();
const { createUrl, listAll, getStats, deleteUrl, codeExists } = require('../database');
const { generateShortCode } = require('../utils/shortcode');

// POST /api/shorten - URL 단축 생성
router.post('/shorten', (req, res) => {
  try {
    const { url, customAlias, expiresIn } = req.body;

    // URL 유효성 검사
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // 커스텀 별칭 유효성 검사
    if (customAlias) {
      if (!/^[a-zA-Z0-9_-]+$/.test(customAlias)) {
        return res.status(400).json({ error: 'Custom alias can only contain letters, numbers, hyphens, and underscores' });
      }
      if (customAlias.length < 2 || customAlias.length > 30) {
        return res.status(400).json({ error: 'Custom alias must be 2-30 characters' });
      }
      if (codeExists(customAlias)) {
        return res.status(409).json({ error: 'Custom alias already in use' });
      }
    }

    // 단축 코드 생성
    const shortCode = customAlias || generateShortCode(codeExists);

    // 만료 시간 계산
    let expiresAt = null;
    if (expiresIn && expiresIn > 0) {
      const expDate = new Date(Date.now() + expiresIn * 60 * 1000);
      expiresAt = expDate.toISOString();
    }

    const result = createUrl(url, shortCode, customAlias || null, expiresAt);

    const protocol = req.protocol;
    const host = req.get('host');
    const shortUrl = `${protocol}://${host}/${result.customAlias || result.shortCode}`;

    res.status(201).json({
      id: result.id,
      shortCode: result.shortCode,
      customAlias: result.customAlias,
      shortUrl,
      expiresAt,
    });
  } catch (err) {
    console.error('Error creating short URL:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/urls - 모든 URL 목록 조회
router.get('/urls', (req, res) => {
  try {
    const urls = listAll();
    const now = new Date();
    const enriched = urls.map((u) => ({
      ...u,
      isExpired: u.expires_at ? new Date(u.expires_at) < now : false,
      displayCode: u.custom_alias || u.short_code,
    }));
    res.json(enriched);
  } catch (err) {
    console.error('Error listing URLs:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/urls/:code/stats - 클릭 통계 조회
router.get('/urls/:code/stats', (req, res) => {
  try {
    const url = getStats(req.params.code);
    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }
    res.json({
      ...url,
      isExpired: url.expires_at ? new Date(url.expires_at) < new Date() : false,
      displayCode: url.custom_alias || url.short_code,
    });
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/urls/:id - URL 삭제
router.delete('/urls/:id', (req, res) => {
  try {
    const result = deleteUrl(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting URL:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
