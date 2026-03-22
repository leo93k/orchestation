import { Router } from 'express';
import { stmts, recordClick } from '../database.js';

const router = Router();

// GET /:code — redirect to original URL
router.get('/:code', (req, res) => {
  const { code } = req.params;

  // Basic sanity check — avoid interfering with static assets
  if (code.includes('.') || code.length > 50) {
    return res.status(404).send('Not found');
  }

  const url = stmts.findByCode.get(code);

  if (!url) {
    // Check if it exists but is expired
    const expired = stmts.findByCodeAny.get(code);
    if (expired) {
      return res.status(410).send(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>🔗 Link Expired</h2>
          <p>This short link has expired.</p>
          <a href="/">← Go to homepage</a>
        </body></html>
      `);
    }
    return res.status(404).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2>🔍 Link Not Found</h2>
        <p>This short link does not exist.</p>
        <a href="/">← Go to homepage</a>
      </body></html>
    `);
  }

  // Record the click asynchronously (non-blocking via sync tx but fast)
  try {
    recordClick(code, {
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      referer: req.get('referer') || '',
    });
  } catch (err) {
    // Never fail a redirect due to analytics error
    console.error('[click tracking error]', err.message);
  }

  // 302 (temporary) redirect — allows analytics to work correctly
  // Use 301 only if you want to cache at browser level (kills click tracking)
  return res.redirect(302, url.original_url);
});

export default router;
