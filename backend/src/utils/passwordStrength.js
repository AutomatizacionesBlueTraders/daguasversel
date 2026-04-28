const zxcvbn = require('zxcvbn');

const MIN_SCORE = 3;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function validatePasswordStrength(password, userInputs = []) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return { valid: false, reason: `La contraseña debe tener al menos ${MIN_LENGTH} caracteres`, score: 0 };
  }
  if (password.length > MAX_LENGTH) {
    return { valid: false, reason: `Máximo ${MAX_LENGTH} caracteres`, score: 0 };
  }
  const clean = userInputs.filter((s) => typeof s === 'string' && s.length > 0);
  const r = zxcvbn(password, clean);
  if (r.score < MIN_SCORE) {
    return {
      valid: false,
      reason: r.feedback?.warning || 'Contraseña demasiado débil',
      score: r.score,
    };
  }
  return { valid: true, score: r.score };
}

module.exports = { validatePasswordStrength };
