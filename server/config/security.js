const crypto = require('crypto');

const production = process.env.NODE_ENV === 'production';
const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!jwtSecret || Buffer.byteLength(jwtSecret) < 32) {
  throw new Error('Set JWT_SECRET to a random secret of at least 32 bytes before starting the server.');
}

const defaultOrigins = [
  'https://myacademyportal.online',
  'https://www.myacademyportal.online',
  'https://myacademy-portal-1.onrender.com',
  ...(!production ? ['http://localhost:5173', 'http://localhost:4173'] : []),
];
const allowedOrigins = (process.env.CORS_ORIGINS || defaultOrigins.join(','))
  .split(',').map((origin) => origin.trim()).filter(Boolean);
for (const origin of allowedOrigins) {
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !['http:', 'https:'].includes(parsed.protocol) ||
      (production && parsed.protocol !== 'https:')) {
    throw new Error('CORS_ORIGINS must contain exact origins, using HTTPS in production.');
  }
}

let whatsappKey;
if (process.env.WHATSAPP_AUTH_KEY) {
  whatsappKey = Buffer.from(process.env.WHATSAPP_AUTH_KEY, 'base64');
  if (whatsappKey.length !== 32) throw new Error('WHATSAPP_AUTH_KEY must be a base64-encoded 32-byte key.');
} else if (production) {
  throw new Error('Set WHATSAPP_AUTH_KEY before starting in production. Keep it separate from JWT_SECRET.');
} else {
  // Development only; production always requires a separately managed key.
  whatsappKey = crypto.createHmac('sha256', jwtSecret).update('development-whatsapp-storage').digest();
}

module.exports = { production, jwtSecret, allowedOrigins, whatsappKey,
  jwtIssuer: 'myacademy-portal', jwtAudience: 'myacademy-users' };
