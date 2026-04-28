require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { createApp } = require('./app');
const db = require('./db');
const { createAndSendResetLink } = require('./controllers/authController');

async function bootstrapAdmin() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').toLowerCase().trim();
  const nombre = (process.env.BOOTSTRAP_ADMIN_NOMBRE || '').trim();
  if (!email || !nombre) return;

  const count = await db('usuarios').count('* as c').first();
  if (Number(count.c) > 0) return;

  console.log('[bootstrap] BD vacía, creando admin inicial:', email);
  const [user] = await db('usuarios').insert({
    email,
    nombre,
    rol: 'admin',
    activo: true,
    email_verificado: false,
    debe_cambiar_password: true,
    password_hash: null,
  }).returning('*');

  try {
    await createAndSendResetLink({
      usuarioId: user.id,
      email: user.email,
      nombre: user.nombre,
      isWelcome: true,
    });
    console.log('[bootstrap] email de invitación enviado');
  } catch (err) {
    console.error('[bootstrap] no se pudo enviar email — el admin igualmente quedó creado y puede usar /forgot-password', err);
  }
}

async function main() {
  try {
    await db.raw('SELECT 1');
    console.log('[db] conectado');
  } catch (err) {
    console.error('[db] no se pudo conectar:', err.message);
    process.exit(1);
  }

  try {
    await bootstrapAdmin();
  } catch (err) {
    console.error('[bootstrap] error:', err.message);
  }

  const app = createApp();
  const port = Number(process.env.PORT || 4000);
  app.listen(port, () => console.log(`[server] escuchando en :${port}`));
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
