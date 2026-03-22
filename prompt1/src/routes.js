const { Router } = require('express');
const crypto = require('crypto');
const db = require('./db');

const router = Router();

function generateSlug(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(length);
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += chars[bytes[i] % chars.length];
  }
  return slug;
}

// POST /api/shorten - Create shortened URL
router.post('/api/shorten', (req, res) => {
  const { url, customSlug, expiresIn = 720 } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  let slug = customSlug || generateSlug();

  if (customSlug) {
    if (!/^[a-zA-Z0-9_-]+$/.test(customSlug)) {
      return res.status(400).json({ error: 'Custom slug may only contain letters, numbers, hyphens, and underscores' });
    }
    const existing = db.getUrl(customSlug);
    if (existing) {
      return res.status(409).json({ error: 'Slug already in use' });
    }
  } else {
    let attempts = 0;
    while (db.getUrl(slug) && attempts < 10) {
      slug = generateSlug();
      attempts++;
    }
    if (db.getUrl(slug)) {
      return res.status(500).json({ error: 'Failed to generate unique slug' });
    }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString();

  try {
    const record = db.createUrl({ slug, originalUrl: url, expiresAt });
    const protocol = req.protocol;
    const host = req.get('host');
    res.status(201).json({
      shortUrl: `${protocol}://${host}/${record.slug}`,
      slug: record.slug,
      originalUrl: record.original_url,
      expiresAt: record.expires_at,
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Slug already in use' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/urls - List all URLs with click counts
router.get('/api/urls', (_req, res) => {
  const urls = db.getAllUrls().map(u => ({
    slug: u.slug,
    originalUrl: u.original_url,
    clicks: u.clicks,
    createdAt: u.created_at,
    expiresAt: u.expires_at,
  }));
  res.json(urls);
});

// GET /api/urls/:slug/stats - Get click statistics for a slug
router.get('/api/urls/:slug/stats', (req, res) => {
  const { slug } = req.params;
  const record = db.getUrl(slug);
  if (!record) {
    return res.status(404).json({ error: 'URL not found' });
  }

  const stats = db.getClickStats(slug);
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const todayClicks = stats.filter(s => s.date === today).reduce((a, s) => a + s.count, 0);
  const weekClicks = stats.filter(s => s.date >= weekAgo).reduce((a, s) => a + s.count, 0);
  const daily = stats.map(s => ({ date: s.date, clicks: s.count }));

  res.json({
    slug: record.slug,
    originalUrl: record.original_url,
    totalClicks: record.clicks,
    todayClicks,
    weekClicks,
    daily,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
  });
});

// DELETE /api/urls/:slug - Delete a URL
router.delete('/api/urls/:slug', (req, res) => {
  const { slug } = req.params;
  const deleted = db.deleteUrl(slug);
  if (!deleted) {
    return res.status(404).json({ error: 'URL not found' });
  }
  res.json({ message: 'Deleted' });
});

// GET /:slug - Redirect to original URL
router.get('/:slug', (req, res) => {
  const { slug } = req.params;
  const record = db.getUrl(slug);

  if (!record) {
    return res.status(404).json({ error: 'Short URL not found' });
  }

  if (record.expires_at && new Date(record.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This short URL has expired' });
  }

  db.incrementClick(slug);
  db.logClick({
    slug,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  res.redirect(301, record.original_url);
});

module.exports = router;
