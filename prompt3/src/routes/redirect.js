const express = require('express');
const urlService = require('../services/url.service');

const router = express.Router();

/**
 * GET /:code - Redirect to original URL.
 * This is the highest-traffic endpoint. Optimized for minimal latency.
 *
 * Flow:
 * 1. Lookup code in DB
 * 2. If not found → 404
 * 3. If expired → 410 Gone
 * 4. Send 302 redirect immediately
 * 5. Track click (synchronous but fast with SQLite WAL mode)
 */
router.get('/:code', (req, res, next) => {
  try {
    const { code } = req.params;

    // Skip codes that look like file extensions (favicon.ico, etc.)
    if (code.includes('.')) {
      return next();
    }

    const record = urlService.resolveCode(code);

    if (!record) {
      return res.status(404).render('error', {
        title: '404 - Not Found',
        statusCode: 404,
        message: 'This shortened URL does not exist.',
      });
    }

    if (record.expired) {
      return res.status(410).render('error', {
        title: '410 - Expired',
        statusCode: 410,
        message: 'This shortened URL has expired.',
      });
    }

    // Redirect first for lowest latency
    res.redirect(302, record.original_url);

    // Track click after response is sent
    urlService.trackClick(record.id, {
      ip: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: req.headers['user-agent'] || '',
      referer: req.headers['referer'] || '',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
