// Test processes never read .env or use production databases/provider credentials.
const crypto = require('crypto');
const path = require('path');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64');
process.env.WHATSAPP_AUTH_KEY = crypto.randomBytes(32).toString('base64');
process.env.CORS_ORIGINS = 'http://localhost:5173,https://portal.example.test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never_use_production';
process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../.cache/mongodb-binaries');
// Alternate official MongoDB hostname also works on networks that reset fastdl.
process.env.MONGOMS_DOWNLOAD_MIRROR ||= 'https://downloads.mongodb.org';
delete process.env.TRUST_PROXY;
delete process.env.SESSION_SECRET;
delete process.env.ALLOW_DEMO_SEED;
