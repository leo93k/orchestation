const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate limiter for URL creation endpoint.
 * 30 requests per minute per IP (configurable via config).
 */
const createUrlLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  },
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  },
});

module.exports = { createUrlLimiter };
