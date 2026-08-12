const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Helper to upload file buffer directly from memory to Cloudinary
 * Bypasses local disk storage entirely (safe for Render/Heroku ephemeral filesystems)
 */
const uploadStreamToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer) {
      return reject(new Error('No file buffer provided for upload.'));
    }
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        console.error('Cloudinary upload_stream error:', error);
        return reject(error);
      }
      resolve(result);
    });
    stream.end(fileBuffer);
  });
};

cloudinary.uploadStreamToCloudinary = uploadStreamToCloudinary;
cloudinary.cloudinary = cloudinary;

module.exports = cloudinary;
