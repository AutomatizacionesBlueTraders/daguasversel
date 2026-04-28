const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { hashToken, generateEmailToken, generateEmailCode } = require('../utils/crypto');
const { validatePasswordStrength } = require('../utils/passwordStrength');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../services/email');

const MAX_CODE_ATTEMPTS = 5;

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    telefono: u.telefono,
    rol: u.rol,
    activo: u.activo,
    debe_cambiar_password: u.debe_cambiar_password,
    email_verificado: u.email_verificado,
    ultimo_login: u.ultimo_login,
    created_at: u.created_at,
  };
}

function signTokens(user) {
  const payload = { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
}

async function createAndSendResetLink({ usuarioId, email, nombre, isWelcome }) {
  const ttlMin = Number(process.env.PASSWORD_RESET_TTL_MIN || 60);
  const tok = generateEmailToken();
  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

  await db.transaction(async (trx) => {
    await trx('password_reset_tokens')
      .where({ usuario_id: usuarioId })
      .whereNull('used_at')
      .update({ used_at: new Date() });

    await trx('password_reset_tokens').insert({
      usuario_id: usuarioId,
      token_hash: tok.hash,
      code_hash: code.hash,
      expires_at: expiresAt,
    });
  });

  const appUrl = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');
  const resetLink = `${appUrl}/restablecer-password?token=${encodeURIComponent(tok.plain)}`;
  const codeEntryUrl = `${appUrl}/recuperar-password/codigo?email=${encodeURIComponent(email)}`;

  if (isWelcome) {
    await sendWelcomeEmail({ to: email, nombre, setupLink: resetLink, code: code.plain, codeEntryUrl, ttlMin });
  } else {
    await sendPasswordResetEmail({ to: email, nombre, resetLink, code: code.plain, codeEntryUrl, ttlMin });
  }
}

async function login(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos', code: 'INVALID_CREDENTIALS' });
  }

  const user = await db('usuarios').where({ email }).first();
  if (!user || !user.password_hash) {
    return res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
  }
  if (!user.activo) {
    return res.status(403).json({ error: 'Usuario desactivado', code: 'USER_DISABLED' });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Credenciales inválidas', code: 'INVALID_CREDENTIALS' });
  }

  await db('usuarios').where({ id: user.id }).update({ ultimo_login: new Date() });
  const tokens = signTokens(user);
  res.json({ user: publicUser(user), ...tokens });
}

async function refresh(req, res) {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) return res.status(400).json({ error: 'Falta refreshToken' });
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await db('usuarios').where({ id: payload.id }).first();
    if (!user || !user.activo) return res.status(401).json({ error: 'Sesión inválida' });
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh inválido' });
  }
}

async function logout(_req, res) {
  res.json({ ok: true });
}

async function me(req, res) {
  const user = await db('usuarios').where({ id: req.user.id }).first();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(publicUser(user));
}

async function forgotPassword(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email requerido', code: 'INVALID_EMAIL' });

  const user = await db('usuarios').where({ email }).first();
  if (!user) {
    return res.status(404).json({ error: 'Email no registrado', code: 'EMAIL_NOT_FOUND' });
  }
  if (!user.activo) {
    return res.status(403).json({ error: 'Usuario desactivado', code: 'USER_DISABLED' });
  }

  await createAndSendResetLink({
    usuarioId: user.id,
    email: user.email,
    nombre: user.nombre,
    isWelcome: false,
  });

  res.json({ ok: true, mensaje: 'Correo enviado. Revisa tu bandeja de entrada y el código de 6 dígitos.' });
}

async function resetPasswordWithToken(req, res) {
  const tokenPlain = String(req.body?.token || '');
  const nuevaPassword = String(req.body?.nueva_password || '');
  if (!tokenPlain || !nuevaPassword) {
    return res.status(400).json({ error: 'Faltan campos', code: 'INVALID_TOKEN' });
  }

  const tokenHash = hashToken(tokenPlain);
  const row = await db('password_reset_tokens').where({ token_hash: tokenHash }).first();
  if (!row) return res.status(400).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
  if (row.used_at) return res.status(400).json({ error: 'Token ya usado', code: 'TOKEN_USED' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Token expirado', code: 'TOKEN_EXPIRED' });
  }

  const user = await db('usuarios').where({ id: row.usuario_id }).first();
  if (!user) return res.status(400).json({ error: 'Token inválido', code: 'INVALID_TOKEN' });
  if (!user.activo) return res.status(403).json({ error: 'Usuario desactivado', code: 'USER_DISABLED' });

  const strength = validatePasswordStrength(nuevaPassword, [user.email, user.nombre]);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason, code: 'WEAK_PASSWORD', score: strength.score });
  }

  const newHash = await bcrypt.hash(nuevaPassword, 10);
  await db.transaction(async (trx) => {
    await trx('usuarios').where({ id: user.id }).update({
      password_hash: newHash,
      debe_cambiar_password: false,
      email_verificado: true,
      updated_at: new Date(),
    });
    await trx('password_reset_tokens').where({ id: row.id }).update({ used_at: new Date() });
    await trx('password_reset_tokens').where({ usuario_id: user.id })
      .whereNull('used_at').update({ used_at: new Date() });
  });

  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
}

async function resetPasswordWithCode(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const codeRaw = String(req.body?.code || '').trim();
  const nuevaPassword = String(req.body?.nueva_password || '');

  if (!email || !codeRaw || !nuevaPassword) {
    return res.status(400).json({ error: 'Faltan campos', code: 'INVALID_CODE' });
  }
  if (!/^\d{6}$/.test(codeRaw)) {
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  const user = await db('usuarios').where({ email }).first();
  if (!user) return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  if (!user.activo) return res.status(403).json({ error: 'Usuario desactivado', code: 'USER_DISABLED' });

  const codeHash = hashToken(codeRaw);
  const row = await db('password_reset_tokens').where({ usuario_id: user.id, code_hash: codeHash }).first();

  if (!row) {
    const latest = await db('password_reset_tokens')
      .where({ usuario_id: user.id })
      .whereNull('used_at')
      .whereNotNull('code_hash')
      .orderBy('created_at', 'desc')
      .first();
    if (latest) {
      const attempts = (latest.attempts || 0) + 1;
      if (attempts >= MAX_CODE_ATTEMPTS) {
        await db('password_reset_tokens').where({ id: latest.id })
          .update({ attempts, used_at: new Date() });
        return res.status(400).json({ error: 'Demasiados intentos. Solicita un nuevo código.', code: 'TOO_MANY_ATTEMPTS' });
      }
      await db('password_reset_tokens').where({ id: latest.id }).update({ attempts });
    }
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  if (row.used_at) return res.status(400).json({ error: 'Código ya usado', code: 'TOKEN_USED' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Código expirado', code: 'TOKEN_EXPIRED' });
  }
  if ((row.attempts || 0) >= MAX_CODE_ATTEMPTS) {
    return res.status(400).json({ error: 'Demasiados intentos. Solicita un nuevo código.', code: 'TOO_MANY_ATTEMPTS' });
  }

  const strength = validatePasswordStrength(nuevaPassword, [user.email, user.nombre]);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason, code: 'WEAK_PASSWORD', score: strength.score });
  }

  const newHash = await bcrypt.hash(nuevaPassword, 10);
  await db.transaction(async (trx) => {
    await trx('usuarios').where({ id: user.id }).update({
      password_hash: newHash,
      debe_cambiar_password: false,
      email_verificado: true,
      updated_at: new Date(),
    });
    await trx('password_reset_tokens').where({ id: row.id }).update({ used_at: new Date() });
    await trx('password_reset_tokens').where({ usuario_id: user.id })
      .whereNull('used_at').update({ used_at: new Date() });
  });

  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
}

async function changePassword(req, res) {
  const passwordActual = String(req.body?.password_actual || '');
  const nuevaPassword = String(req.body?.nueva_password || '');
  if (!nuevaPassword) return res.status(400).json({ error: 'Falta nueva contraseña', code: 'INVALID_PASSWORD' });

  const user = await db('usuarios').where({ id: req.user.id }).first();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Si ya tiene contraseña definida, exige la actual.
  if (user.password_hash && !user.debe_cambiar_password) {
    if (!passwordActual) return res.status(400).json({ error: 'Falta contraseña actual', code: 'INVALID_PASSWORD' });
    const ok = await bcrypt.compare(passwordActual, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Contraseña actual incorrecta', code: 'INVALID_PASSWORD' });
  }

  const strength = validatePasswordStrength(nuevaPassword, [user.email, user.nombre]);
  if (!strength.valid) {
    return res.status(400).json({ error: strength.reason, code: 'WEAK_PASSWORD', score: strength.score });
  }

  const newHash = await bcrypt.hash(nuevaPassword, 10);
  await db('usuarios').where({ id: user.id }).update({
    password_hash: newHash,
    debe_cambiar_password: false,
    email_verificado: true,
    updated_at: new Date(),
  });
  res.json({ ok: true, mensaje: 'Contraseña actualizada' });
}

module.exports = {
  login,
  refresh,
  logout,
  me,
  forgotPassword,
  resetPasswordWithToken,
  resetPasswordWithCode,
  changePassword,
  createAndSendResetLink,
};
