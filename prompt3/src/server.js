const { createApp } = require('./app');
const { getDatabase, closeDatabase } = require('./db/database');
const config = require('./config');
const pino = require('pino');

const logger = pino({ name: 'server' });

// Initialize database (runs migrations)
getDatabase();

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, baseUrl: config.baseUrl }, 'URL Shortener is running');
  console.log(`\n  URL Shortener is running at ${config.baseUrl}\n`);
});

// === Graceful shutdown ===
function shutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal');

  server.close(() => {
    logger.info('HTTP server closed');
    closeDatabase();
    logger.info('Database connection closed');
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
