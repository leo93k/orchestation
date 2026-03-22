import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import apiRouter from './routes/api.js';
import redirectRouter from './routes/redirect.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for accurate IP logging (behind nginx/load balancer)
app.set('trust proxy', 1);

// Static files (UI)
app.use(express.static(join(__dirname, 'public')));

// ── Routes ─────────────────────────────────────────────────
app.use('/api', apiRouter);

// Health check endpoint (for load balancers / monitoring)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Redirect route — must come LAST (catch-all for /:code)
app.use(redirectRouter);

// ── Global error handler ───────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT;
if (!PORT) {
  console.error('❌  PORT environment variable is required. Example: PORT=3000 node server.js');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`✅  URL Shortener running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api`);
});

export default app;
