const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  db: {
    path: process.env.DB_PATH || path.join(__dirname, 'data', 'urls.db'),
  },
  shortCode: {
    length: 7,
    alphabet: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    maxRetries: 3,
    fallbackLength: 8,
  },
  rateLimit: {
    windowMs: 60 * 1000,
    max: 30,
  },
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  reservedSlugs: new Set([
    'api', 'dashboard', 'admin', 'static', 'health',
    'login', 'logout', 'signup', 'settings', 'favicon.ico',
  ]),
};

module.exports = config;
