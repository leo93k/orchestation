const config = require('../config');

/**
 * Generate a random short code using nanoid.
 * nanoid v5 is ESM-only, so we use a custom implementation
 * based on crypto.getRandomValues for the same security guarantees.
 */
const crypto = require('crypto');

const { alphabet, length: defaultLength } = config.shortCode;

/**
 * Generate a cryptographically random string of given length from the configured alphabet.
 * @param {number} size - Length of the generated code
 * @returns {string}
 */
function generateCode(size = defaultLength) {
  const bytes = crypto.randomBytes(size);
  let result = '';
  for (let i = 0; i < size; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

/**
 * Generate a unique short code that doesn't collide with existing ones in the DB.
 * Strategy: try up to maxRetries with default length, then fall back to longer code.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string} A unique short code
 * @throws {Error} If unable to generate unique code (extremely unlikely)
 */
function generateUniqueCode(db) {
  const { maxRetries, fallbackLength } = config.shortCode;
  const checkStmt = db.prepare('SELECT 1 FROM urls WHERE code = ?');

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateCode(defaultLength);
    if (!checkStmt.get(code)) return code;
  }

  // Fallback: extend length to reduce collision probability
  const code = generateCode(fallbackLength);
  if (!checkStmt.get(code)) return code;

  throw new Error('Failed to generate unique short code after all retries');
}

/**
 * Validate a custom slug.
 * @param {string} slug
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCustomSlug(slug) {
  if (slug.length < 3 || slug.length > 30) {
    return { valid: false, reason: 'Custom slug must be 3-30 characters long' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return { valid: false, reason: 'Custom slug can only contain letters, numbers, hyphens, and underscores' };
  }

  if (config.reservedSlugs.has(slug.toLowerCase())) {
    return { valid: false, reason: `"${slug}" is a reserved word and cannot be used` };
  }

  return { valid: true };
}

module.exports = { generateCode, generateUniqueCode, validateCustomSlug };
