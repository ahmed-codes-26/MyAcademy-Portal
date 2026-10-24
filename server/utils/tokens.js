const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtIssuer, jwtAudience } = require('../config/security');

function credentialVersion(user) {
  return crypto.createHmac('sha256', jwtSecret)
    .update(`${user._id}:${user.password}`).digest('hex');
}

function issueToken(user, role) {
  return jwt.sign({ id: user._id.toString(), role, credentialVersion: credentialVersion(user) },
    jwtSecret, { algorithm: 'HS256', expiresIn: '7d', jwtid: crypto.randomUUID(), issuer: jwtIssuer, audience: jwtAudience });
}

function matchesCredentials(user, version) {
  if (typeof version !== 'string' || !/^[a-f0-9]{64}$/.test(version)) return false;
  return crypto.timingSafeEqual(Buffer.from(version, 'hex'), Buffer.from(credentialVersion(user), 'hex'));
}

module.exports = { issueToken, matchesCredentials };
