// Centralized configuration constants
const DEFAULT_N8N_WEBHOOK_URL = "https://paneln8n.cosasinteligentes.co/webhook/demodaguas2";

export const N8N_WEBHOOK_URL =
  import.meta.env.VITE_N8N_WEBHOOK_URL?.trim() || DEFAULT_N8N_WEBHOOK_URL;
