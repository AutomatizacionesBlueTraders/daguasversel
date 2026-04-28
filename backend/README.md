# Backend — daguasversel

Backend Express con auth (JWT + invitación por email + recuperación con código), gestión de usuarios y rate limiting.

## Stack

- Node 20+, Express
- Postgres (Knex)
- bcrypt, jsonwebtoken, zxcvbn
- Resend (email vía HTTP)
- express-rate-limit

## Requisitos locales

```
cp .env.example .env
# Edita .env con tus valores
npm install
npm run migrate
npm run dev
```

## Endpoints

- `POST /api/auth/login` — `{email, password}` → `{user, accessToken, refreshToken}`
- `POST /api/auth/refresh` — `{refreshToken}` → `{accessToken}`
- `POST /api/auth/logout` (auth) — `{ok}`
- `GET  /api/auth/me` (auth) — datos del usuario autenticado
- `POST /api/auth/forgot-password` — `{email}` → envía link + código
- `POST /api/auth/reset-password` — `{token, nueva_password}`
- `POST /api/auth/reset-password-with-code` — `{email, code, nueva_password}`
- `POST /api/auth/change-password` (auth) — `{password_actual?, nueva_password}`
- `GET    /api/auth/users` (admin)
- `POST   /api/auth/users` (admin) — crea + envía invitación
- `PATCH  /api/auth/users/:id` (admin)
- `DELETE /api/auth/users/:id` (admin)
- `POST   /api/auth/users/:id/resend-invite` (admin)

Códigos de error en `data.code`:
`INVALID_CREDENTIALS`, `USER_DISABLED`, `INVALID_TOKEN`, `INVALID_CODE`, `TOKEN_EXPIRED`, `TOKEN_USED`, `TOO_MANY_ATTEMPTS`, `WEAK_PASSWORD`, `EMAIL_NOT_FOUND`, `EMAIL_DUPLICATE`, `NAME_DUPLICATE`.

## Variables de entorno

Ver `.env.example`. Imprescindibles:

- `DATABASE_URL` (Postgres de EasyPanel)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (cadenas largas y distintas)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (dominio verificado)
- `APP_URL` (frontend en Vercel — va en los enlaces del email)
- `CORS_ORIGINS` (URLs del frontend permitidas, CSV)

Bootstrap opcional para crear el primer admin la primera vez que arranca con BD vacía:

- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NOMBRE`

El admin se crea sin contraseña y recibe el email de invitación. Una vez creado, puedes (y deberías) limpiar estas variables.

## Despliegue en EasyPanel

1. Crea un servicio Postgres en EasyPanel y copia su connection string.
2. Crea un servicio "App" apuntando al repo, con root path `backend/`.
3. EasyPanel detecta el `Dockerfile`. El `CMD` corre las migraciones y arranca el servidor.
4. Configura las variables de entorno (sección anterior).
5. Expón el puerto `4000` y configura un dominio público.
6. La URL pública se usa en `VITE_API_BASE_URL` del frontend en Vercel.

## Migraciones

```
npm run migrate              # aplicar pendientes
npm run migrate:rollback     # revertir última
npm run migrate:make nombre  # crear nueva
```
