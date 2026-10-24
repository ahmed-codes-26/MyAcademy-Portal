const crypto = require('crypto');
const { whatsappKey } = require('../config/security');
const PREFIX = 'enc:v1:';

function encryptCredential(value) {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', whatsappKey, iv);
  cipher.setAAD(Buffer.from('myacademy-whatsapp-v1'));
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

function decryptCredential(value) {
  if (!value || !value.startsWith(PREFIX)) return value; // Legacy values are migrated separately.
  const payload = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (payload.length < 29) throw new Error('Invalid encrypted credential.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', whatsappKey, payload.subarray(0, 12));
  decipher.setAAD(Buffer.from('myacademy-whatsapp-v1'));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}

module.exports = { encryptCredential, decryptCredential, PREFIX };
