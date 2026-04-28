const crypto = require('crypto');

function hashToken(plain) {
  return crypto.createHash('sha256').update(String(plain), 'utf8').digest('hex');
}

function generateEmailToken() {
  const plain = crypto.randomBytes(32).toString('base64url');
  return { plain, hash: hashToken(plain) };
}

function generateEmailCode() {
  const n = crypto.randomInt(0, 1_000_000);
  const plain = String(n).padStart(6, '0');
  return { plain, hash: hashToken(plain) };
}

module.exports = { hashToken, generateEmailToken, generateEmailCode };
