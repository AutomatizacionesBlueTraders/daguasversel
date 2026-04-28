# daguasversel

Sistema de gestión D'Aguas. Frontend Vite + React desplegado en Vercel; backend Express + Postgres desplegado en EasyPanel.

## Estructura

```
daguasversel/
├── src/                    # Frontend (Vite + React + TS)
├── public/
├── index.html
├── vercel.json             # Config de Vercel (SPA rewrites)
├── package.json            # Frontend
├── backend/                # Backend Express + Knex + Postgres
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md           # Detalle del backend
└── GUIA_GESTION_USUARIOS.md
```

## Stack

**Frontend**: Vite, React 18, TypeScript, Tailwind, shadcn/ui, react-router, axios, zxcvbn (lazy).
**Backend**: Node 20+, Express, Knex, Postgres, bcrypt, JWT, Resend, express-rate-limit, zxcvbn.

## Flujo de auth implementado

- Login con email + contraseña → JWT (access 15 min + refresh 7 días)
- Recuperación con dos vías paralelas (mismo correo):
  - Botón con token (link clásico)
  - Código de 6 dígitos (resistente a Outlook 365 / Safe Links)
- Forzar cambio de contraseña al primer login
- Validación con zxcvbn (score ≥ 3, considera email y nombre)
- Rate limiting en `/login`, `/forgot-password`, `/reset-password*`
- Anti-brute-force: 5 intentos por código → invalidación

## Local

### Backend

```bash
cd backend
cp .env.example .env       # Edita las variables
npm install
npm run migrate            # Aplica migraciones
npm run dev                # Arranca en :4000
```

### Frontend

```bash
cp .env.example .env       # VITE_API_BASE_URL apuntando al backend local
npm install
npm run dev                # Arranca en :8080
```

## Deploy

### Backend en EasyPanel

1. **Crea servicio Postgres** en EasyPanel. Copia su `DATABASE_URL`.
2. **Crea servicio "App"** apuntando al repo de GitHub.
   - Root path: `backend/`
   - EasyPanel detecta el `Dockerfile` automáticamente.
3. **Variables de entorno** (sección Environment del servicio):
   - `DATABASE_URL` — connection string de Postgres
   - `DATABASE_SSL` — `false` si Postgres está en la misma red interna
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` — dos cadenas random largas y distintas
     (genera con `openssl rand -hex 64`)
   - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`
   - `APP_URL` — URL pública del frontend en Vercel (sin slash final)
   - `CORS_ORIGINS` — URLs del frontend permitidas, separadas por coma
   - `PASSWORD_RESET_TTL_MIN=60`
   - `RATE_LIMIT_DISABLED=false`
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NOMBRE` — opcional, crea el primer admin si la BD está vacía y le envía email de invitación
4. **Expón puerto 4000** y configura un dominio público.
5. Al arrancar, el container ejecuta `knex migrate:latest` y luego el server. Si tienes `BOOTSTRAP_ADMIN_*` configurado y la BD está vacía, se crea el admin y se le envía el correo.

### Frontend en Vercel

1. **Importar proyecto** desde GitHub.
   - Vercel detecta Vite automáticamente. El `vercel.json` ya tiene la config de SPA rewrites (necesarios para react-router).
   - Root directory: la raíz del repo (no `frontend/`).
2. **Variables de entorno** (Build & Development settings → Environment Variables):
   - `VITE_API_BASE_URL` — URL pública del backend en EasyPanel + `/api` (ej. `https://daguasversel-api.easypanel.host/api`)
   - `VITE_N8N_WEBHOOK_URL` — opcional, si quieres sobreescribir el default
3. Deploy. La primera vez tarda ~2 min.

> ⚠️ Vite inyecta `VITE_*` en build-time, no en runtime. Cualquier cambio de variable requiere **redeploy sin cache**.

### Resend

El sistema asume que ya hay una cuenta Resend con dominio verificado. Solo configura `RESEND_API_KEY` y `RESEND_FROM_EMAIL` (debe ser del dominio verificado) en EasyPanel.

## Rutas frontend

- `/auth` — login (público)
- `/recuperar-password` — pide email
- `/recuperar-password/codigo` — ingresar código de 6 dígitos
- `/restablecer-password?token=...` — landing del link del email
- `/cambiar-password` — cambio voluntario o forzado en primer login (auth)
- `/` — home (PQR)
- `/usuarios` — gestión (solo admin)
- ...resto del sistema (deudores, facturación, etc.)

## Endpoints backend

Ver [`backend/README.md`](./backend/README.md).

## Integración n8n

Cuando se crea, edita o elimina un usuario, el frontend dispara un webhook a `VITE_N8N_WEBHOOK_URL` con la acción y los datos del usuario. Es best-effort: si falla, el flujo del usuario no se interrumpe.

## Bootstrap del primer admin

Si despliegas con BD vacía, configura `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_NOMBRE` en EasyPanel. Al arrancar:
1. Crea el admin con `password_hash=null`, `debe_cambiar_password=true`.
2. Le envía el correo de invitación con el código de 6 dígitos.
3. El admin recibe el correo, va a `/recuperar-password/codigo`, define su contraseña y entra.
4. Luego puedes (y deberías) limpiar las variables `BOOTSTRAP_ADMIN_*`.

## Comandos útiles

```bash
# Frontend
npm run dev          # Vite dev server
npm run build        # Producción
npm run lint
npm run test

# Backend
cd backend
npm run dev          # node --watch
npm run start        # producción
npm run migrate
npm run migrate:rollback
npm run migrate:make NOMBRE
```
