const multer = require('multer');
const path = require('path');
const { TextDecoder } = require('util');
const { uploadLimiter } = require('./security');
const optimizeImage = require('../utils/imageOptimization');

const imageExtensions = new Set(['png', 'apng', 'jpg', 'jpeg', 'jpe', 'jfif', 'gif', 'webp', 'avif', 'bmp', 'tif', 'tiff', 'heic', 'heif', 'ico']);
const documentExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt']);
const aliases = { jpeg: 'jpg', jpe: 'jpg', jfif: 'jpg', apng: 'png', tif: 'tiff', heif: 'heic' };
const normalize = (ext) => aliases[ext] || ext;
let detector;
let activeUploads = 0;

function uploadCapacity(req, res, next) {
  // Memory storage must also be bounded across accounts, not just per file.
  if (activeUploads >= 4) {
    res.setHeader('Retry-After', '5');
    return res.status(429).json({ message: 'Uploads are busy. Please try again in a few seconds.' });
  }
  activeUploads++;
  let released = false;
  const release = () => { if (!released) { released = true; activeUploads--; } };
  res.once('finish', release);
  res.once('close', release);
  next();
}

function upload(field, maxBytes, imagesOnly = false) {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 20, parts: 21,
      fieldSize: 8192, fieldNameSize: 100, headerPairs: 100 },
    fileFilter(req, file, callback) {
      const ext = path.extname(file.originalname).slice(1).toLowerCase();
      if (!imageExtensions.has(ext) && (imagesOnly || !documentExtensions.has(ext))) {
        const error = new Error('Unsupported file type.'); error.status = 400;
        return callback(error);
      }
      callback(null, true);
    },
  }).single(field);

  return [uploadLimiter, uploadCapacity, parse, async (req, res, next) => {
    if (!req.file) return next();
    try {
      detector ||= import('file-type');
      const { fileTypeFromBuffer } = await detector;
      const detected = await fileTypeFromBuffer(req.file.buffer);
      const ext = path.extname(req.file.originalname).slice(1).toLowerCase();
      let valid = detected && normalize(detected.ext) === normalize(ext);
      // Older Office formats share a Compound File Binary container.
      if (['doc', 'xls', 'ppt'].includes(ext) && detected?.ext === 'cfb') valid = true;
      if (['csv', 'txt'].includes(ext) && !detected) {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer);
        valid = text.length > 0 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text);
      }
      if (!valid) return res.status(400).json({ message: 'File contents do not match a supported file type.' });
      req.file.verifiedExtension = ext;
      req.file.verifiedResourceType = imageExtensions.has(ext) ? 'image' : 'raw';
      if (req.file.verifiedResourceType === 'image') {
        const optimized = await optimizeImage(req.file.buffer, { profile: imagesOnly, extension: ext });
        if (optimized) {
          req.file.buffer = optimized;
          req.file.size = optimized.length;
          req.file.mimetype = 'image/webp';
          req.file.verifiedExtension = 'webp';
        }
      }
      next();
    } catch (error) {
      // Malformed/truncated files fail closed, without exposing parser details.
      res.status(400).json({ message: 'Invalid or damaged upload.' });
    }
  }];
}

module.exports = {
  profileUpload: upload('profilePicture', 5 * 1024 * 1024, true),
  noteUpload: upload('file', 10 * 1024 * 1024),
  imageExtensions,
};
