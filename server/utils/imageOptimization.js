const sharp = require('sharp');

async function optimizeImage(buffer, { profile = false, extension } = {}) {
  // Preserve animation, multipage images and uncommon formats instead of flattening or losing pages.
  if (!['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'webp', 'avif'].includes(extension)) return null;
  const image = sharp(buffer, { limitInputPixels: 40 * 1000 * 1000 });
  const metadata = await image.metadata();
  if ((metadata.pages || 1) > 1) return null;
  const maxSize = profile ? 512 : 2560;
  const data = await image.rotate().resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: profile ? 82 : 90, alphaQuality: 100, effort: 4 }).toBuffer();
  // Small notes already in an efficient format need no conversion. Profile size/privacy still enforced.
  if (!profile && data.length >= buffer.length && metadata.width <= maxSize && metadata.height <= maxSize) return null;
  return data;
}

module.exports = optimizeImage;
