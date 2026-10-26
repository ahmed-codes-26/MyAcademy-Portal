const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('node:path');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const portalRoutes = require('../client/portal-routes.json');
const { production: defaultProduction, allowedOrigins: defaultOrigins } = require('./config/security');
const { apiLimiter, auditRequests } = require('./middleware/security');
const { rejectQueryOperators } = require('./middleware/validation');
const { reportError } = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teachersCrudRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teacher');
const notesRoutes = require('./routes/notes');
const whatsappRoutes = require('./routes/whatsapp');
const studentPortalRoutes = require('./routes/student');

function createApp(options = {}) {
  const production = options.production ?? defaultProduction;
  const allowedOrigins = options.allowedOrigins ?? defaultOrigins;
  const app = express();
  const frontend = options.staticDir || (process.env.SERVE_CLIENT === 'true' ? path.join(__dirname, '../client/dist') : null);
  const homeFile = frontend && path.join(frontend, 'index.html');
  const homeHtml = homeFile && fs.existsSync(homeFile) ? fs.readFileSync(homeFile, 'utf8') : '';
  const structuredDataHashes = [...homeHtml.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)]
    .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);

  // Middleware
  app.disable('x-powered-by');
  app.use(compression());
  // Trust only the explicitly configured proxy/network, never every forwarded header.
  const proxy = options.trustProxy ?? process.env.TRUST_PROXY;
  if (proxy) app.set('trust proxy', /^\d+$/.test(proxy) ? Number(proxy) : proxy);
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      scriptSrc: ["'self'", ...structuredDataHashes, 'https://www.googletagmanager.com'],
      fontSrc: ["'self'"], connectSrc: ["'self'", ...allowedOrigins, 'https://www.google-analytics.com', 'https://region1.google-analytics.com', 'https://www.googletagmanager.com'],
      upgradeInsecureRequests: production ? [] : null,
    } },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: production ? { maxAge: 31536000 } : false,
  }));
  app.use('/api', auditRequests);
  app.use((req, res, next) => {
    // A production build accidentally served on a preview hostname stays non-indexable.
    if (req.hostname !== 'myacademy.ahmedcodes.pro' || !production || !['/', '/robots.txt', '/sitemap.xml'].includes(req.path)) {
      res.set('X-Robots-Tag', 'noindex, follow');
    }
    next();
  });
  app.use((req, res, next) => {
    if (production && !req.secure && req.path !== '/api/health') {
      return res.status(400).json({ message: 'HTTPS is required.' });
    }
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      const error = new Error('Origin not allowed.');
      error.status = 403;
      callback(error);
    },
    credentials: true,
  }));
  app.use('/api', apiLimiter);
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb', parameterLimit: 50 }));
  app.use(rejectQueryOperators);

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/teachers', teachersCrudRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/notes', notesRoutes);
  app.use('/api/test-notes', require('./routes/testNotes'));
  app.use('/api/teacher/whatsapp', whatsappRoutes);
  app.use('/api/student', studentPortalRoutes);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Your API is running', timestamp: new Date().toISOString() });
  });

  // Optional single-service deployment. API-only hosting remains unchanged.
  if (frontend && fs.existsSync(path.join(frontend, 'index.html'))) {
    app.use(express.static(frontend, {
      index: false,
      etag: true,
      setHeaders(res, file) {
        res.set('Cache-Control', file.includes(`${path.sep}assets${path.sep}`)
          ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
      },
    }));
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      if (req.path === '/') return res.sendFile(path.join(frontend, 'index.html'));
      if (portalRoutes.includes(req.path)) return res.sendFile(path.join(frontend, 'portal.html'));
      res.status(404).sendFile(path.join(frontend, '404.html'));
    });
  }

  // Return JSON rather than Express's HTML error pages or production stack traces.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    reportError(error, 'request_failed', req);
    if (error.name === 'MulterError') {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
        .json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the upload size limit.' : 'Invalid multipart upload.' });
    }
    const status = error.status === 403 ? 403 : error.status === 413 ? 413 :
      (error.status === 400 || ['ValidationError', 'CastError'].includes(error.name)) ? 400 : 500;
    res.status(status).json({ message: status === 500 ? 'Server error.' :
      status === 403 ? 'Origin not allowed.' : status === 413 ? 'Request is too large.' : 'Invalid request.' });
  });


  return app;
}

module.exports = createApp;
