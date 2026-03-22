const express = require('express');
const path = require('path');
const { requestLogger } = require('./middleware/request-logger');
const { errorHandler } = require('./middleware/error-handler');
const { getDatabaseSize } = require('./db/database');
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');
const redirectRoutes = require('./routes/redirect');

/**
 * Create and configure the Express application.
 * Separated from server.js for testability (supertest can import app without listening).
 */
function createApp() {
  const app = express();

  // === View engine ===
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // === Middleware stack (order matters) ===
  // 1. Request logging
  app.use(requestLogger);

  // 2. Static files (before body parsing for efficiency)
  app.use(express.static(path.join(__dirname, 'public')));

  // 3. Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // === Routes (order matters: specific before catch-all) ===
  // 4. Health check (no auth, no rate limit)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      dbSizeBytes: getDatabaseSize(),
      timestamp: new Date().toISOString(),
    });
  });

  // 5. API routes
  app.use('/api', apiRoutes);

  // 6. Page routes (dashboard, home)
  app.use(pageRoutes);

  // 7. Redirect handler (catch-all /:code — MUST be last)
  app.use(redirectRoutes);

  // === Error handling ===
  // 404 for unmatched routes
  app.use((req, res) => {
    res.status(404).render('error', {
      title: '404 - Not Found',
      statusCode: 404,
      message: 'The page you are looking for does not exist.',
    });
  });

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
