const pino = require('pino');

const logger = pino({
  level: 'info',
  redact: ['password', 'token', 'authorization', 'creds', 'keys', 'phone', 'email'],
});

// Database and provider errors can contain submitted values and credentials.
function reportError(error, event, req) {
  logger.error({ event, requestId: req?.requestId,
    errorName: error?.name, errorCode: typeof error?.code === 'number' ? error.code : undefined });
}

module.exports = { logger, reportError };
