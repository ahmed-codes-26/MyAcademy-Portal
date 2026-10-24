const crypto = require('crypto');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { logger } = require('../utils/logger');

const limiter = (limit, windowMs, extra = {}) => rateLimit({
  limit, windowMs, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }, ...extra,
});
const byUser = (req) => `${req.userRole}:${req.userId}`;

// A tuition centre may share one public IP; account limits handle authenticated traffic.
const apiLimiter = limiter(10000, 15 * 60 * 1000, { skip: (req) => req.path === '/health' });
const userLimiter = limiter(600, 15 * 60 * 1000, { keyGenerator: byUser });
const uploadLimiter = limiter(20, 15 * 60 * 1000, { keyGenerator: byUser });
const loginLimiter = limiter(50, 15 * 60 * 1000, { skipSuccessfulRequests: true });
const accountLoginLimiter = limiter(10, 15 * 60 * 1000, {
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const value = req.body?.identifier || req.body?.email;
    return typeof value === 'string'
      ? crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
      : ipKeyGenerator(req.ip);
  },
});
const recoveryLimiter = limiter(5, 60 * 60 * 1000);

function auditRequests(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('Cache-Control', 'no-store');
  res.on('finish', () => {
    if (req.userRole === 'admin' || !['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
        res.statusCode >= 400 || req.path.endsWith('/download')) {
      logger.info({ event: 'api_audit', requestId: req.requestId,
        actorId: req.userId?.toString(), role: req.userRole,
        method: req.method, path: req.originalUrl.split('?')[0].slice(0, 200),
        status: res.statusCode });
    }
  });
  next();
}

module.exports = { apiLimiter, userLimiter, uploadLimiter, loginLimiter,
  accountLoginLimiter, recoveryLimiter, auditRequests };
