const RESEND_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — envío omitido', { to, subject });
    return false;
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[email] RESEND_FROM_EMAIL no configurada — envío omitido');
    return false;
  }
  const fromName = process.env.RESEND_FROM_NAME;
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  try {
    const resp = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error('[email] envío falló', { status: resp.status, body });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] error de red', err);
    return false;
  }
}

function commonStyles() {
  return `
    body { margin:0; padding:0; background:#f5f7fa; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#1f2937; }
    .wrap { max-width:560px; margin:0 auto; padding:24px; }
    .card { background:#ffffff; border-radius:12px; padding:32px; border:1px solid #e5e7eb; }
    h1 { font-size:20px; margin:0 0 16px; color:#111827; }
    p { line-height:1.55; margin:0 0 12px; color:#374151; }
    .code { font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace; font-size:36px; letter-spacing:10px; background:#f3f4f6; padding:18px 24px; border-radius:8px; text-align:center; margin:20px 0; color:#111827; font-weight:700; }
    ol { padding-left:20px; }
    ol li { margin-bottom:6px; }
    .button { display:inline-block; background:#0ea5e9; color:#ffffff !important; text-decoration:none; padding:12px 22px; border-radius:8px; font-weight:600; }
    .muted { color:#6b7280; font-size:13px; }
    .divider { border:0; border-top:1px solid #e5e7eb; margin:24px 0; }
  `;
}

function welcomeTemplate({ nombre, setupLink, code, codeEntryUrl, ttlMin }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${commonStyles()}</style></head><body><div class="wrap"><div class="card">
    <h1>Bienvenido, ${escapeHtml(nombre || '')}</h1>
    <p>Te invitamos al sistema de gestión D'Aguas. Para activar tu cuenta y definir tu contraseña, sigue estos pasos:</p>
    <ol>
      <li>Abre <a href="${escapeAttr(codeEntryUrl)}">esta página</a> de ingreso de código.</li>
      <li>Escribe el código de 6 dígitos que aparece abajo.</li>
      <li>Define tu nueva contraseña.</li>
    </ol>
    <div class="code">${code}</div>
    <p class="muted">El código y el enlace son válidos por ${ttlMin} minutos.</p>
    <hr class="divider" />
    <p>Si tu correo te lo permite, también puedes usar este botón directo:</p>
    <p><a class="button" href="${escapeAttr(setupLink)}">Definir mi contraseña</a></p>
    <p class="muted">El botón puede no funcionar en correos corporativos (Outlook 365, Defender). En ese caso usa el código de 6 dígitos.</p>
  </div></div></body></html>`;

  const text = [
    `Bienvenido, ${nombre || ''}.`,
    '',
    'Para activar tu cuenta:',
    `1) Abre: ${codeEntryUrl}`,
    `2) Ingresa este código: ${code}`,
    `3) Define tu nueva contraseña.`,
    '',
    `El código es válido por ${ttlMin} minutos.`,
    '',
    `Alternativa (puede no funcionar en correos corporativos): ${setupLink}`,
  ].join('\n');

  return { subject: 'Bienvenido a D\'Aguas — define tu contraseña', html, text };
}

function resetTemplate({ nombre, resetLink, code, codeEntryUrl, ttlMin }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${commonStyles()}</style></head><body><div class="wrap"><div class="card">
    <h1>Recuperación de contraseña</h1>
    <p>Hola ${escapeHtml(nombre || '')}, recibimos una solicitud para restablecer tu contraseña. Sigue estos pasos:</p>
    <ol>
      <li>Abre <a href="${escapeAttr(codeEntryUrl)}">esta página</a>.</li>
      <li>Escribe el código de 6 dígitos.</li>
      <li>Define tu nueva contraseña.</li>
    </ol>
    <div class="code">${code}</div>
    <p class="muted">El código y el enlace son válidos por ${ttlMin} minutos. Si tú no solicitaste este cambio, ignora este correo.</p>
    <hr class="divider" />
    <p>Alternativa con un solo clic:</p>
    <p><a class="button" href="${escapeAttr(resetLink)}">Restablecer mi contraseña</a></p>
    <p class="muted">El botón puede no funcionar en correos corporativos. En ese caso usa el código.</p>
  </div></div></body></html>`;

  const text = [
    `Hola ${nombre || ''},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña.',
    `1) Abre: ${codeEntryUrl}`,
    `2) Ingresa este código: ${code}`,
    `3) Define tu nueva contraseña.`,
    '',
    `El código es válido por ${ttlMin} minutos.`,
    '',
    `Alternativa: ${resetLink}`,
    '',
    'Si tú no solicitaste este cambio, ignora este correo.',
  ].join('\n');

  return { subject: 'Recupera tu contraseña — D\'Aguas', html, text };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

async function sendWelcomeEmail({ to, nombre, setupLink, code, codeEntryUrl, ttlMin }) {
  const tpl = welcomeTemplate({ nombre, setupLink, code, codeEntryUrl, ttlMin });
  return sendEmail({ to, ...tpl });
}

async function sendPasswordResetEmail({ to, nombre, resetLink, code, codeEntryUrl, ttlMin }) {
  const tpl = resetTemplate({ nombre, resetLink, code, codeEntryUrl, ttlMin });
  return sendEmail({ to, ...tpl });
}

module.exports = { sendEmail, sendWelcomeEmail, sendPasswordResetEmail };
