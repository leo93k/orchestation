const crypto = require('crypto');

const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

function generateShortCode(existsFn) {
  let code;
  let attempts = 0;
  const maxAttempts = 10;

  do {
    const bytes = crypto.randomBytes(CODE_LENGTH);
    code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CHARS[bytes[i] % CHARS.length];
    }
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Failed to generate unique short code');
    }
  } while (existsFn && existsFn(code));

  return code;
}

module.exports = { generateShortCode };
