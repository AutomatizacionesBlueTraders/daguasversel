const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  const origins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(cors({
    origin: origins.length ? origins : true,
    credentials: false,
  }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('[error]', err);
    res.status(500).json({ error: 'Error interno', code: 'INTERNAL_ERROR' });
  });

  return app;
}

module.exports = { createApp };
