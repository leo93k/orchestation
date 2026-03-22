import { Router } from 'express';
import { nanoid } from 'nanoid';
import { stmts } from '../database.js';

const router = Router();

// Validate URL format
function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// POST /api/shorten
router.post('/shorten', (req, res) => {
  const { url, custom_code, expires_in_days } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' });
  }

  const trimmedUrl = url.trim();
  if (!isValidUrl(trimmedUrl)) {
    return res.status(400).json({ error: 'Invalid URL. Must start with http:// or https://' });
  }

  // Determine short code
  let code;
  let isCustom = false;

  if (custom_code) {
    const sanitized = custom_code.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized || sanitized.length < 2 || sanitized.length > 50) {
      return res.status(400).json({ error: 'Custom code must be 2-50 alphanumeric characters' });
    }
    const existing = stmts.findByCodeAny.get(sanitized);
    if (existing) {
      return res.status(409).json({ error: `Custom code "${sanitized}" is already taken` });
    }
    code = sanitized;
    isCustom = true;
  } else {
    // Generate unique code (retry on collision, extremely rare)
    let attempts = 0;
    do {
      code = nanoid(7);
      attempts++;
      if (attempts > 10) {
        return res.status(500).json({ error: 'Failed to generate unique code' });
      }
    } while (stmts.findByCodeAny.get(code));
  }

  // Calculate expiration
  let expiresAt = null;
  if (expires_in_days) {
    const days = parseInt(expires_in_days, 10);
    if (isNaN(days) || days < 1 || days > 3650) {
      return res.status(400).json({ error: 'expires_in_days must be between 1 and 3650' });
    }
    const exp = new Date();
    exp.setDate(exp.getDate() + days);
    expiresAt = exp.toISOString().replace('T', ' ').slice(0, 19);
  }

  try {
    stmts.create.run({
      code,
      original_url: trimmedUrl,
      is_custom: isCustom ? 1 : 0,
      expires_at: expiresAt,
    });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Code already exists' });
    }
    throw err;
  }

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const shortUrl = `${baseUrl}/${code}`;

  return res.status(201).json({
    code,
    short_url: shortUrl,
    original_url: trimmedUrl,
    is_custom: isCustom,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });
});

// GET /api/urls — list all URLs
router.get('/urls', (_req, res) => {
  const urls = stmts.listAll.all();
  return res.json({ urls, total: urls.length });
});

// GET /api/urls/:code — detail + stats
router.get('/urls/:code', (req, res) => {
  const { code } = req.params;
  const url = stmts.findByCodeAny.get(code);
  if (!url) {
    return res.status(404).json({ error: 'URL not found' });
  }

  const clicksByDay = stmts.getClicksByDay.all(url.id);
  const recentClicks = stmts.getClickLogs.all(url.id);

  return res.json({
    ...url,
    status: url.expires_at && new Date(url.expires_at) <= new Date() ? 'expired' : 'active',
    clicks_by_day: clicksByDay,
    recent_clicks: recentClicks,
  });
});

// DELETE /api/urls/:code
router.delete('/urls/:code', (req, res) => {
  const { code } = req.params;
  const url = stmts.findByCodeAny.get(code);
  if (!url) {
    return res.status(404).json({ error: 'URL not found' });
  }
  stmts.deleteByCode.run(code);
  return res.json({ message: `"${code}" deleted successfully` });
});

export default router;
