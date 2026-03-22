const pinoHttp = require('pino-http');

const requestLogger = pinoHttp({
  level: process.env.LOG_LEVEL || 'info',
  // Don't log health check spam
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = { requestLogger };
