const express = require('express');
const urlService = require('../services/url.service');
const { validateBody, createUrlSchema } = require('../middleware/validate');
const { createUrlLimiter } = require('../middleware/rate-limiter');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/urls - Create a shortened URL
 */
router.post('/urls', createUrlLimiter, validateBody(createUrlSchema), (req, res, next) => {
  try {
    const { url, customSlug, expiresInMinutes } = req.validatedBody;

    const result = urlService.createUrl({
      url,
      customSlug: customSlug || undefined,
      expiresInMinutes: expiresInMinutes || undefined,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/urls - List all shortened URLs with pagination
 */
router.get('/urls', (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      config.pagination.maxLimit,
      Math.max(1, parseInt(req.query.limit, 10) || config.pagination.defaultLimit)
    );

    const result = urlService.listUrls({ page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/urls/:id - Get URL details
 */
router.get('/urls/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'ID must be a number' } });
    }

    const url = urlService.getUrlById(id);
    if (!url) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'URL not found' } });
    }

    res.json(url);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/urls/:id/stats - Get click statistics
 */
router.get('/urls/:id/stats', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'ID must be a number' } });
    }

    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 7));
    const stats = urlService.getUrlStats(id, { days });

    if (!stats) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'URL not found' } });
    }

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/urls/:id - Delete a URL
 */
router.delete('/urls/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: { code: 'INVALID_ID', message: 'ID must be a number' } });
    }

    const deleted = urlService.deleteUrl(id);
    if (!deleted) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'URL not found' } });
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
