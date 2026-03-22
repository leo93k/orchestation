const pino = require('pino');
const logger = pino({ name: 'error-handler' });

/**
 * Centralized error handling middleware.
 * Must have 4 parameters for Express to recognize it as error middleware.
 */
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    logger.error({ err, method: req.method, url: req.url }, 'Unhandled server error');
  }

  res.status(statusCode).json({
    error: {
      code: err.code || (isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message: isServerError ? 'An internal error occurred' : err.message,
    },
  });
}

/**
 * 404 handler for API routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `${req.method} ${req.path} not found`,
    },
  });
}

module.exports = { errorHandler, notFoundHandler };
