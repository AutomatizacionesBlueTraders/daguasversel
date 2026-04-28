# Guía — Sistema de gestión de usuarios + auth + recuperación con código

Esta guía permite replicar en otro proyecto el sistema completo implementado
en Alcaldía Sopó. Está pensada para que otro Claude (u otro desarrollador)
pueda integrar todo en un proyecto distinto, incluyendo uno hecho en Lovable
que se está migrando a Vercel.

## 0. Resumen — qué hace este sistema

- **Login multi-rol** con JWT (access 15 min + refresh 7 días).
- **Invitación por email**: el admin crea un usuario sin contraseña; el
  usuario recibe un correo y define su contraseña la primera vez.
- **Recuperación de contraseña en dos vías paralelas, mismo correo**:
  - Link clásico con token (botón en el email)
  - **Código de 6 dígitos** que se ingresa manualmente — vía robusta
    para correos corporativos (Microsoft 365 / Safe Links / Defender)
    que reescriben URLs y rompen el token del link.
- **Validación fuerte de contraseñas** con zxcvbn (score ≥ 3, considera
  email y nombre del usuario para no permitirlos como contraseña).
- **Rate limiting** en `/login`, `/forgot-password`, `/reset-password*`
  para prevenir bruteforce, email bombing y enumeración por timing.
- **Forgot-password informativo**: dice si el email no está registrado
  (decisión consciente para sistemas internos donde los emails son
  institucionales y la UX importa más que la enumeración).
- **Forzar cambio de contraseña** al primer login (`debe_cambiar_password`).
- **Gestión de usuarios para admin**: listar, crear, editar, activar/
  desactivar, reenviar invitación. Cada usuario está asociado a una
  "dependencia" (en el sistema fuente, departamento de la alcaldía).
- **Anti-brute-force del código OTP**: 5 intentos por fila → invalida
  la fila y obliga a pedir un código nuevo.

---

## 1. Stack del sistema fuente

- **Backend**: Node 20+, Express, Knex (query builder), PostgreSQL.
- **Frontend**: React 18, Vite, axios, react-router-dom, Tailwind, Heroicons.
- **Email**: Resend (HTTP, sin SDK — `fetch` directo).
- **Hash de contraseñas**: bcrypt (rounds=10).
- **JWT**: `jsonwebtoken`.
- **Validación de contraseñas**: zxcvbn (lazy-loaded en frontend, ~400 KB).
- **Rate limiting**: `express-rate-limit`.

## 2. Adaptaciones según el stack del proyecto destino

| Si tu destino usa... | Adaptación |
|---|---|
| Next.js (App Router) | Mover los endpoints a `app/api/auth/*/route.ts`. La estructura interna del controller no cambia mucho. |
| Next.js (Pages Router) | A `pages/api/auth/*.ts`. |
| Supabase | **Considera usar `supabase.auth` directamente** — ya tiene login, reset por link, OTP por email, RLS. Sólo replica la pantalla de "ingresar código" si necesitas el flujo OTP custom (Supabase tiene su propio OTP). |
| FastAPI / Python | Mismas tablas; reemplaza bcrypt → argon2, jsonwebtoken → PyJWT, Knex → SQLAlchemy. Patrón idéntico. |
| Prisma en lugar de Knex | Las migraciones cambian de sintaxis pero el schema final es igual. |
| MySQL en vez de Postgres | Cuidado con índices parciales (no soporta `WHERE` en índice); en lugar elimina la fila al usarla, no la "marca usada". |

**Si el destino es Lovable migrando a Vercel y NO usa Supabase**, sigue
esta guía tal cual con un backend Express separado en otro proyecto de
Vercel (o EasyPanel/Railway/Render). El frontend en Vercel le pega vía
HTTPS, mismas variables que se documentan abajo.

---

## 3. Esquema de base de datos

Tres migraciones (idempotentes, ejecutables en orden).

### 3.1. Tabla `usuarios`

Asume que ya existe con campos típicos (`id`, `email`, `nombre`,
`password_hash`, `rol`, `activo`, `created_at`). Si no existe, créala
con esa forma.

### 3.2. Migración 1 — extender usuarios

```js
// backend/src/db/migrations/036_extender_usuarios_auth.js
exports.up = async function (knex) {
  // Hacer password_hash nullable: usuarios invitados aún no la han definido
  await knex.schema.alterTable('usuarios', (t) => {
    t.string('password_hash').nullable().alter();
    t.boolean('email_verificado').notNullable().defaultTo(false);
    t.boolean('debe_cambiar_password').notNullable().defaultTo(false);
    t.timestamp('ultimo_login');
  });

  // Usuarios existentes (sin invitación) ya tienen password definido
  await knex('usuarios').whereNotNull('password_hash').update({
    email_verificado: true,
    debe_cambiar_password: false,
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('usuarios', (t) => {
    t.dropColumn('email_verificado');
    t.dropColumn('debe_cambiar_password');
    t.dropColumn('ultimo_login');
  });
};
```

### 3.3. Migración 2 — tabla de tokens

```js
// backend/src/db/migrations/037_create_password_reset_tokens.js
exports.up = function (knex) {
  return knex.schema.createTable('password_reset_tokens', (t) => {
    t.increments('id').primary();
    t.integer('usuario_id').unsigned().notNullable()
      .references('id').inTable('usuarios').onDelete('CASCADE');
    t.string('token_hash', 64).notNullable().unique(); // sha256 hex
    t.timestamp('expires_at').notNullable();
    t.timestamp('used_at');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('usuario_id');
    t.index('expires_at');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('password_reset_tokens');
};
```

### 3.4. Migración 3 — añadir código OTP

```js
// backend/src/db/migrations/038_add_code_to_password_reset_tokens.js
exports.up = async function (knex) {
  await knex.schema.alterTable('password_reset_tokens', (t) => {
    t.string('code_hash', 64);                  // sha256 del código
    t.integer('attempts').notNullable().defaultTo(0); // anti-brute-force
  });
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_pwreset_code_hash
      ON password_reset_tokens (code_hash)
      WHERE code_hash IS NOT NULL AND used_at IS NULL
  `);
};

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_pwreset_code_hash');
  await knex.schema.alterTable('password_reset_tokens', (t) => {
    t.dropColumn('code_hash');
    t.dropColumn('attempts');
  });
};
```

**Estado final** de `password_reset_tokens`:

| Campo | Tipo | Nota |
|---|---|---|
| id | int (PK) | autoincrement |
| usuario_id | FK usuarios.id | cascade delete |
| token_hash | string(64) unique | sha256 del token plano |
| code_hash | string(64) nullable | sha256 del código de 6 dígitos |
| expires_at | timestamp | TTL configurable (default 1 h) |
| used_at | timestamp nullable | nulo = activo |
| attempts | int default 0 | contador de intentos fallidos |
| created_at | timestamp | |

---

## 4. Backend

### 4.1. Variables de entorno

```env
# JWT
JWT_SECRET=<una cadena random larga>
JWT_REFRESH_SECRET=<otra cadena random larga, distinta>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@<dominio-verificado-en-resend>
RESEND_FROM_NAME=<Nombre que aparece en el remitente>

# URLs
APP_URL=https://<frontend-prod>.com    # Va en los enlaces y URLs del email
CORS_ORIGINS=https://<frontend-prod>.com  # CSV si hay varios

# Reset de contraseña
PASSWORD_RESET_TTL_MIN=60               # Minutos de validez de tokens y códigos

# Rate limit
RATE_LIMIT_DISABLED=false               # `true` solo en pruebas
```

### 4.2. Helpers de hashing y generación

```js
// crypto helpers
const crypto = require('crypto');

function hashToken(plain) {
  return crypto.createHash('sha256').update(plain, 'utf8').digest('hex');
}

function generateEmailToken() {
  const plain = crypto.randomBytes(32).toString('base64url'); // ~43 chars
  return { plain, hash: hashToken(plain) };
}

function generateEmailCode() {
  // crypto.randomInt es uniforme y seguro
  const n = crypto.randomInt(0, 1_000_000);
  const plain = String(n).padStart(6, '0');
  return { plain, hash: hashToken(plain) };
}
```

### 4.3. Servicio de email (Resend HTTP)

Estructura: una función `sendEmail` genérica que llama a Resend, dos
helpers (`sendWelcomeEmail`, `sendPasswordResetEmail`) que arman el HTML
+ texto plano y delegan en `sendEmail`.

**Reglas críticas:**

- HTML debe llevar el código en un bloque grande (`font-size:36px`,
  `font-family:monospace`, `letter-spacing:10px`, fondo claro).
- Pasos numerados con la URL de ingreso de código (que NO lleva token,
  solo `?email=`, así no se rompe en filtros corporativos).
- Botón clásico al final, con advertencia: "puede no funcionar en
  correos corporativos".
- **Versión `text/plain` obligatoria**: muchos filtros sólo pasan plain
  text. El código en plain text siempre llega íntegro.
- Si `RESEND_API_KEY` no está configurada, loguear y devolver `false`,
  nunca tirar el flujo abajo.

```js
const RESEND_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — omitido', { to, subject });
    return false;
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const fromName = process.env.RESEND_FROM_NAME;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const resp = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!resp.ok) {
    console.error('[email] envío falló', { status: resp.status });
    return false;
  }
  return true;
}
```

Ver `backend/src/services/email.js` del proyecto fuente para las plantillas
HTML completas (con bloque grande del código, pasos numerados y botón).

### 4.4. Middleware de auth

```js
// requireAuth: verifica el JWT y carga req.user
// requireRole(rol): exige que req.user.rol === rol

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(rol) {
  return (req, res, next) => {
    if (req.user?.rol !== rol) return res.status(403).json({ error: 'No autorizado' });
    next();
  };
}
```

### 4.5. Middleware de rate limiting

```js
const rateLimit = require('express-rate-limit');

function build({ windowMs, max, message }) {
  return rateLimit({
    windowMs, max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
    skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  });
}

const loginLimiter = build({
  windowMs: 15 * 60 * 1000, max: 10,
  message: 'Demasiados intentos. Intenta de nuevo en unos minutos.',
});

const passwordResetLimiter = build({
  windowMs: 60 * 60 * 1000, max: 5,
  message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.',
});

module.exports = { loginLimiter, passwordResetLimiter };
```

**Importante en producción detrás de proxy** (EasyPanel, nginx, Vercel, etc.):

```js
// app.js
app.set('trust proxy', 1);
```

Sin esto, `express-rate-limit` ve la IP del proxy en lugar de la del
usuario y limita a todos por igual.

### 4.6. Validación de contraseñas

```js
// utils/passwordStrength.js
const zxcvbn = require('zxcvbn');

const MIN_SCORE = 3;
const MIN_LENGTH = 8;
const MAX_LENGTH = 128;

function validatePasswordStrength(password, userInputs = []) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return { valid: false, reason: `Mínimo ${MIN_LENGTH} caracteres`, score: 0 };
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
```

`userInputs` es CRÍTICO: pasar `[user.email, user.nombre]` para que
zxcvbn rechace contraseñas que contengan datos del propio usuario.

### 4.7. Controlador — `createAndSendResetLink`

Esta función es el núcleo del flujo. Genera token + código en la
**misma fila** (comparten expiración), invalida los anteriores en
transacción, y dispara el email.

```js
async function createAndSendResetLink({ usuarioId, email, nombre, isWelcome }) {
  const ttlMin = Number(process.env.PASSWORD_RESET_TTL_MIN || 60);
  const tok = generateEmailToken();
  const code = generateEmailCode();
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000);

  await db.transaction(async (trx) => {
    // Invalida anteriores: solo 1 par activo por usuario a la vez
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

  const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetLink = `${appUrl}/restablecer-password?token=${encodeURIComponent(tok.plain)}`;
  const codeEntryUrl = `${appUrl}/recuperar-password/codigo?email=${encodeURIComponent(email)}`;

  if (isWelcome) {
    await sendWelcomeEmail({ to: email, nombre, setupLink: resetLink, code: code.plain, codeEntryUrl, ttlMin });
  } else {
    await sendPasswordResetEmail({ to: email, nombre, resetLink, code: code.plain, codeEntryUrl, ttlMin });
  }
}
```

### 4.8. Endpoints — resumen

| Método | Ruta | Auth | Rate limit | Hace |
|---|---|---|---|---|
| POST | `/auth/login` | — | login | Devuelve `{user, accessToken, refreshToken}` |
| POST | `/auth/refresh` | — | — | Renueva access token desde refresh |
| POST | `/auth/logout` | sí | — | Stateless: solo confirma |
| GET | `/auth/me` | sí | — | Datos del usuario actual |
| POST | `/auth/forgot-password` | — | reset | Envía correo (link + código) |
| POST | `/auth/reset-password` | — | reset | Reset con token del link |
| POST | `/auth/reset-password-with-code` | — | reset | Reset con código de 6 dígitos |
| POST | `/auth/change-password` | sí | — | Cambia contraseña (forzado o voluntario) |
| GET | `/auth/users` | admin | — | Lista de usuarios (con filtros) |
| POST | `/auth/users` | admin | — | Crea usuario, manda invitación |
| PATCH | `/auth/users/:id` | admin | — | Edita rol, dependencia, activo |
| POST | `/auth/users/:id/resend-invite` | admin | — | Reenvía email de invitación |

### 4.9. Endpoint clave — `resetPasswordWithCode`

```js
const MAX_CODE_ATTEMPTS = 5;

async function resetPasswordWithCode(req, res) {
  const email = (req.body?.email || '').toLowerCase().trim();
  const codeRaw = String(req.body?.code || '').trim();
  const nuevaPassword = req.body?.nueva_password;

  if (!email || !codeRaw || !nuevaPassword) {
    return res.status(400).json({ error: 'Faltan campos', code: 'INVALID_CODE' });
  }
  if (!/^\d{6}$/.test(codeRaw)) {
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  const user = await db('usuarios').where({ email }).first();
  // Anti-enumeración: mismo error si email no existe que si código mal.
  if (!user) return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  if (!user.activo) return res.status(403).json({ error: 'Usuario desactivado', code: 'USER_DISABLED' });

  const codeHash = hashToken(codeRaw);
  const row = await db('password_reset_tokens')
    .where({ usuario_id: user.id, code_hash: codeHash })
    .first();

  if (!row) {
    // Código mal: cuenta como intento fallido sobre la fila activa más reciente
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
        return res.status(400).json({ error: 'Demasiados intentos', code: 'TOO_MANY_ATTEMPTS' });
      }
      await db('password_reset_tokens').where({ id: latest.id }).update({ attempts });
    }
    return res.status(400).json({ error: 'Código inválido', code: 'INVALID_CODE' });
  }

  if (row.used_at) return res.status(400).json({ error: 'Ya usado', code: 'TOKEN_USED' });
  if (new Date(row.expires_at) < new Date()) {
    return res.status(400).json({ error: 'Expirado', code: 'TOKEN_EXPIRED' });
  }
  if ((row.attempts || 0) >= MAX_CODE_ATTEMPTS) {
    return res.status(400).json({ error: 'Demasiados intentos', code: 'TOO_MANY_ATTEMPTS' });
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
    });
    await trx('password_reset_tokens').where({ id: row.id }).update({ used_at: new Date() });
    await trx('password_reset_tokens').where({ usuario_id: user.id })
      .whereNull('used_at').update({ used_at: new Date() });
  });

  return res.json({ ok: true, mensaje: 'Contraseña actualizada' });
}
```

**Códigos de error** que el frontend debe distinguir (mismos para reset
con token y con código):

- `INVALID_CODE` / `INVALID_TOKEN` → genérico
- `TOKEN_EXPIRED` → expiró
- `TOKEN_USED` → ya se usó o fue reemplazado
- `TOO_MANY_ATTEMPTS` → 5 intentos fallidos
- `WEAK_PASSWORD` → contraseña no pasa zxcvbn
- `USER_DISABLED` → cuenta desactivada
- `EMAIL_NOT_FOUND` → solo en `/forgot-password`, indica email no registrado

### 4.10. CRUD de usuarios

`createUser` debe:
1. Validar email + nombre + rol + dependencia_id (todos requeridos).
2. Verificar que la dependencia existe.
3. Verificar que el email no esté tomado.
4. Insertar con `password_hash: null`, `email_verificado: false`,
   `debe_cambiar_password: true`.
5. Llamar a `createAndSendResetLink({isWelcome: true})` — el usuario
   recibe el correo y define su contraseña.

`updateUser` debe:
1. Permitir editar nombre, rol, dependencia_id, activo.
2. Bloquear que el admin se desactive a sí mismo.
3. Validar que la dependencia existe si cambia.

---

## 5. Frontend

### 5.1. AuthContext

```js
// context/AuthContext.jsx — esqueleto

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // sessionStorage con prefijo único por tab para que dos tabs no se
  // pisen sesiones (window.name persiste por tab y sobrevive a reloads)
  const tabKey = useMemo(() => {
    if (!window.name) window.name = `tab_${Date.now()}_${Math.random()}`;
    return window.name;
  }, []);
  const storage = useMemo(() => ({
    get: (k) => sessionStorage.getItem(`${tabKey}::${k}`),
    set: (k, v) => sessionStorage.setItem(`${tabKey}::${k}`, v),
    del: (k) => sessionStorage.removeItem(`${tabKey}::${k}`),
  }), [tabKey]);

  useEffect(() => {
    // Al montar, si hay token, /me. Si falla, limpia.
    const token = storage.get('accessToken');
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((r) => setUser(r.data))
      .catch(() => { storage.del('accessToken'); storage.del('refreshToken'); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const r = await api.post('/auth/login', { email, password });
    storage.set('accessToken', r.data.accessToken);
    storage.set('refreshToken', r.data.refreshToken);
    setUser(r.data.user);
    return r.data.user;
  }

  function logout() {
    api.post('/auth/logout').catch(() => {});
    storage.del('accessToken');
    storage.del('refreshToken');
    setUser(null);
  }

  async function updatePassword({ password_actual, nueva_password }) {
    await api.post('/auth/change-password', { password_actual, nueva_password });
    await refreshMe();
  }

  async function refreshMe() {
    const r = await api.get('/auth/me');
    setUser(r.data);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updatePassword, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 5.2. Cliente axios con auto-refresh

```js
// api/axios.js
import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const tabKey = window.name;
  const token = tabKey && sessionStorage.getItem(`${tabKey}::accessToken`);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh en 401: pide refresh, reintenta UNA vez
let refreshing = null;
api.interceptors.response.use((r) => r, async (err) => {
  const original = err.config;
  if (err.response?.status !== 401 || original._retry) throw err;
  original._retry = true;
  const tabKey = window.name;
  const refreshToken = tabKey && sessionStorage.getItem(`${tabKey}::refreshToken`);
  if (!refreshToken) throw err;

  refreshing = refreshing || axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  try {
    const r = await refreshing;
    sessionStorage.setItem(`${tabKey}::accessToken`, r.data.accessToken);
    original.headers.Authorization = `Bearer ${r.data.accessToken}`;
    return api(original);
  } finally {
    refreshing = null;
  }
});

export default api;
```

### 5.3. ProtectedRoute

```jsx
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  // Forzar cambio de contraseña si aplica
  if (user.debe_cambiar_password) return <Navigate to="/cambiar-password" replace />;
  if (roles && !roles.includes(user.rol)) return <Navigate to="/no-autorizado" replace />;
  return children;
}
```

### 5.4. PasswordStrengthMeter (lazy-loaded)

zxcvbn pesa ~400 KB con sus diccionarios. Cargarlo de forma diferida:

```jsx
let zxcvbnPromise = null;
function loadZxcvbn() {
  if (!zxcvbnPromise) zxcvbnPromise = import('zxcvbn').then((m) => m.default || m);
  return zxcvbnPromise;
}

export async function evaluatePassword(password, userInputs = []) {
  if (!password) return null;
  const zxcvbn = await loadZxcvbn();
  const clean = userInputs.filter((s) => typeof s === 'string' && s.length > 0);
  const r = zxcvbn(password, clean);
  return { score: r.score, warning: r.feedback?.warning, suggestions: r.feedback?.suggestions };
}

export default function PasswordStrengthMeter({ password, userInputs = [], minScore = 3 }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!password) { setR(null); return; }
    let cancel = false;
    evaluatePassword(password, userInputs).then((x) => !cancel && setR(x));
    return () => { cancel = true; };
  }, [password, userInputs.join('|')]);
  // ... render barra de score + texto
}
```

Llamar `await evaluatePassword(...)` en el `handleSubmit` de cada
formulario antes de enviar al backend, y bloquear si `score < 3`.

### 5.5. Páginas necesarias

| Ruta | Componente | Quién |
|---|---|---|
| `/login` | Login | público |
| `/recuperar-password` | RecuperarPassword (form de email) | público |
| `/recuperar-password/codigo` | IngresarCodigoRecuperacion | público |
| `/restablecer-password?token=...` | RestablecerPassword | público |
| `/cambiar-password` | CambiarPassword (forzado o voluntario) | autenticado |
| `/admin/usuarios` | Usuarios (lista + CRUD) | admin |

### 5.6. Pantalla de ingreso de código — patrón clave

```jsx
const [code, setCode] = useState('');

function onCodeChange(e) {
  // Solo dígitos, máx 6
  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
}

<input
  type="text"
  inputMode="numeric"
  autoComplete="one-time-code"   // Importante: iOS/Chrome ofrecen pegar OTP del SMS/email
  value={code}
  onChange={onCodeChange}
  className="text-center text-2xl font-mono tracking-[0.5em] py-3"
  placeholder="000000"
  maxLength={6}
/>
```

Manejo de errores estructurado (lee `data.code`, no el texto):

```js
function mapErrorCode(code) {
  switch (code) {
    case 'INVALID_CODE': return 'invalid';
    case 'TOKEN_EXPIRED': return 'expired';
    case 'TOKEN_USED': return 'used';
    case 'TOO_MANY_ATTEMPTS': return 'too_many';
    case 'WEAK_PASSWORD': return 'weak';
    default: return null;
  }
}

const NEEDS_NEW_CODE = new Set(['expired', 'used', 'too_many']);
// Si reason ∈ NEEDS_NEW_CODE: mostrar botón "Enviar código nuevo"
```

### 5.7. Atajos visuales claves

- En `/login`, debajo de "¿Olvidaste tu contraseña?": un **segundo enlace
  pequeño** "¿Te enviaron un código por correo? Úsalo aquí" → `/recuperar-password/codigo`.

  Razón: usuario nuevo creado por admin recibe el correo, lee el código, va al
  login (única URL que conoce) y necesita encontrar el atajo visible.

- En `/recuperar-password`, después de enviar email: CTA prominente
  "Ya recibí el código — ingresarlo" con `?email=` propagado.

- En `/restablecer-password` cuando el token falla (`TOKEN_*`): mostrar
  pantalla "este enlace ya no sirve" con form de reenvío Y atajo
  "Ya tengo el código de 6 dígitos — ingresar".

---

## 6. Configuración de Resend

1. Cuenta en [resend.com](https://resend.com).
2. **Verificar un dominio** (no se puede enviar desde dominios no verificados):
   - Resend → Domains → Add Domain.
   - Pegan registros DNS (SPF, DKIM, DMARC).
   - Esperar a que digan "Verified" (puede tomar 1-24 h).
3. Crear API key en Settings → API Keys.
4. Configurar variables de entorno del backend.

**Si los correos llegan a SPAM**:
- Falta DKIM o DMARC.
- El dominio remitente y el dominio del frontend son distintos (no es problema, pero si se pueden alinear, mejor).
- Texto del email parece phishing (evita "URGENTE", "click aquí ahora", todo en mayúsculas).

---

## 7. Despliegue

### 7.1. Frontend en Vercel

`frontend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Vercel project settings:**
- Root Directory: `frontend` (si el repo es monorepo).
- Variables de entorno (build time):
  - `VITE_API_BASE_URL=https://<backend>/api`
  - `VITE_API_URL=https://<backend>` (si tienes descargas directas de archivos)

**Críticas:**
- Vite inyecta variables `VITE_*` en BUILD TIME, no runtime. Cualquier
  cambio requiere **redeploy sin cache**.
- Si recargar `/login` da 404, falta `vercel.json` o el Root Directory
  está mal.

### 7.2. Backend (donde sea)

Puede estar en Vercel (serverless), Railway, Render, EasyPanel, etc.
Solo necesita:
- Node 20+, PostgreSQL.
- Las variables de entorno de la sección 4.1.
- `app.set('trust proxy', 1)` si está detrás de proxy.
- CORS configurable: `cors({ origin: process.env.CORS_ORIGINS.split(',') })`
- Migraciones aplicadas al arrancar (Knex `migrate.latest()`).

---

## 8. Roles y dependencias — adaptar al dominio

El sistema fuente tiene 3 roles (`admin`, `dependencia`, `conductor`) y
una tabla `dependencias` con 28 secretarías. Para adaptar:

1. **Cambiar roles**: editar la constante `ROLES_VALIDOS` en el controller
   y los `ProtectedRoute` del frontend.
2. **Si no hay "dependencia"**: el sistema asocia cada usuario a una
   dependencia. Si tu dominio no tiene esa relación, quita la columna
   `dependencia_id` y el campo del formulario, o renómbrala a algo que
   tenga sentido (ej. `equipo_id`, `area_id`).
3. **Si hay más datos del usuario** (teléfono, cargo): agrégalos como
   columnas a `usuarios` y campos al CRUD.

---

## 9. Pruebas mínimas — checklist

Antes de declarar terminado:

- [ ] Login con credenciales correctas → redirige al área del rol.
- [ ] Login con contraseña mala → mensaje genérico, no dice si el email existe.
- [ ] 11 intentos seguidos → al 11° dice "demasiados intentos" (rate limit).
- [ ] "Olvidé contraseña" con email registrado → llega correo con código y botón.
- [ ] "Olvidé contraseña" con email NO registrado → mensaje claro "no está registrado".
- [ ] Click en el botón del email (Gmail) → carga restablecer, funciona.
- [ ] Click en el botón del email (Outlook 365) → puede romperse (Safe Links).
- [ ] Ingresar código → funciona.
- [ ] Ingresar código mal 5 veces → al 6° dice "demasiados intentos, pide nuevo".
- [ ] Pedir código nuevo → invalida el anterior; el viejo deja de funcionar.
- [ ] Esperar > TTL → código y link expiran, mensaje claro.
- [ ] Usar el código → invalida también el link de la misma sesión.
- [ ] Usuario desactivado intenta login → mensaje específico.
- [ ] Admin crea usuario → llega correo de bienvenida.
- [ ] Usuario nuevo entra al sistema → forzado a `/cambiar-password` antes de continuar.
- [ ] Contraseña "12345678" → rechazada (zxcvbn score < 3).
- [ ] Contraseña que contiene el email del usuario → rechazada.
- [ ] Admin desactiva su propio usuario → bloqueado.

---

## 10. Notas finales para el siguiente Claude

- **No saltes el rate limit en producción**. Dejarlo en `RATE_LIMIT_DISABLED=true`
  por descuido te puede costar la cuenta de Resend.
- **El TTL de 1 hora es razonable**. Si lo bajas a 15 min, sube la fricción
  del usuario corporativo (a veces tardan en revisar el correo).
- **No reemplaces el link por el código solo**. El usuario sin filtros
  corporativos prefiere el botón. Mantén ambas vías.
- **Email plain text es OBLIGATORIO**. Si lo omites, los filtros más
  estrictos descartan el correo entero.
- **El código va en plain text del email**, no en URL. Las URLs se
  reescriben; el texto plano no.
- **`code_entry_url` no lleva token**. Solo el email. Por eso es robusta
  ante reescritura.
- **`window.name` para aislar tabs**: pequeño detalle pero permite que
  un admin trabaje en una tab y use sesión de otro rol en otra sin
  pisarse.

Tiempo estimado total para una integración completa: **8-12 horas**
incluyendo pruebas y verificación de DNS de Resend.
