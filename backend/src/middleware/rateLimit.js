const rateLimit = require('express-rate-limit');

function build({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  });
}

const loginLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
});

const passwordResetLimiter = build({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
});

module.exports = { loginLimiter, passwordResetLimiter };
