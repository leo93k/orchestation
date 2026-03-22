const express = require('express');
const urlService = require('../services/url.service');
const config = require('../config');

const router = express.Router();

/**
 * GET / - Home page with URL shortening form
 */
router.get('/', (req, res) => {
  res.render('home', {
    title: 'URL Shortener',
    baseUrl: config.baseUrl,
  });
});

/**
 * GET /dashboard - List all shortened URLs
 */
router.get('/dashboard', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const result = urlService.listUrls({ page, limit: 20 });

  res.render('dashboard', {
    title: 'Dashboard - URL Shortener',
    baseUrl: config.baseUrl,
    urls: result.data,
    pagination: result.pagination,
  });
});

/**
 * GET /dashboard/:id - Detailed click statistics for a URL
 */
router.get('/dashboard/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).render('error', {
      title: 'Error',
      statusCode: 400,
      message: 'Invalid URL ID.',
    });
  }

  const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
  const stats = urlService.getUrlStats(id, { days });

  if (!stats) {
    return res.status(404).render('error', {
      title: '404 - Not Found',
      statusCode: 404,
      message: 'URL not found.',
    });
  }

  res.render('stats', {
    title: `Stats: ${stats.url.code} - URL Shortener`,
    baseUrl: config.baseUrl,
    stats,
    days,
  });
});

module.exports = router;
