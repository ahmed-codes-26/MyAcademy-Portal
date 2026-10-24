// Existing originals stay intact; Cloudinary's CDN serves an appropriately sized modern image.
export default function profileImage(url, displaySize = 80) {
  if (typeof url !== 'string' || !url.startsWith('https://res.cloudinary.com/') || !url.includes('/image/upload/') || url.includes('/s--')) return url;
  const size = Math.min(512, Math.max(32, displaySize * 2));
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto:good,c_limit,w_${size},h_${size}/`);
}
