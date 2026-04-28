const db = require('../db');
const { createAndSendResetLink } = require('./authController');

const ROLES = ['admin', 'usuario', 'tecnico'];

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

async function listUsers(_req, res) {
  const users = await db('usuarios').select('*').orderBy('created_at', 'desc');
  res.json(users.map(publicUser));
}

async function createUser(req, res) {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const nombre = String(req.body?.nombre || '').trim();
  const telefono = req.body?.telefono ? String(req.body.telefono).trim() : null;
  const rol = String(req.body?.rol || 'usuario');

  if (!email || !nombre) {
    return res.status(400).json({ error: 'Email y nombre son requeridos' });
  }
  if (!ROLES.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  const existing = await db('usuarios').where({ email }).first();
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un usuario con este email', code: 'EMAIL_DUPLICATE' });
  }

  const nombreExiste = await db('usuarios').whereRaw('LOWER(nombre) = ?', [nombre.toLowerCase()]).first();
  if (nombreExiste) {
    return res.status(409).json({ error: 'Ya existe un usuario con este nombre', code: 'NAME_DUPLICATE' });
  }

  const [user] = await db('usuarios').insert({
    email,
    nombre,
    telefono,
    rol,
    activo: true,
    email_verificado: false,
    debe_cambiar_password: true,
    password_hash: null,
  }).returning('*');

  await createAndSendResetLink({ usuarioId: user.id, email: user.email, nombre: user.nombre, isWelcome: true });

  res.status(201).json(publicUser(user));
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });

  const user = await db('usuarios').where({ id }).first();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const patch = {};
  if (req.body?.nombre !== undefined) patch.nombre = String(req.body.nombre).trim();
  if (req.body?.telefono !== undefined) patch.telefono = req.body.telefono ? String(req.body.telefono).trim() : null;
  if (req.body?.rol !== undefined) {
    if (!ROLES.includes(req.body.rol)) return res.status(400).json({ error: 'Rol inválido' });
    patch.rol = req.body.rol;
  }
  if (req.body?.activo !== undefined) {
    const activo = Boolean(req.body.activo);
    if (!activo && user.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }
    patch.activo = activo;
  }

  if (Object.keys(patch).length === 0) return res.json(publicUser(user));

  patch.updated_at = new Date();
  const [updated] = await db('usuarios').where({ id }).update(patch).returning('*');
  res.json(publicUser(updated));
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID inválido' });
  if (id === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }
  const deleted = await db('usuarios').where({ id }).del();
  if (!deleted) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
}

async function resendInvite(req, res) {
  const id = Number(req.params.id);
  const user = await db('usuarios').where({ id }).first();
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (!user.activo) return res.status(400).json({ error: 'Usuario desactivado' });
  await createAndSendResetLink({
    usuarioId: user.id,
    email: user.email,
    nombre: user.nombre,
    isWelcome: !user.password_hash,
  });
  res.json({ ok: true, mensaje: 'Invitación reenviada' });
}

module.exports = { listUsers, createUser, updateUser, deleteUser, resendInvite };
