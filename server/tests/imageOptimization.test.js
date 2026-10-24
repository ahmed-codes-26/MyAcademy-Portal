const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const optimizeImage = require('../utils/imageOptimization');

test('profile images shrink to at most 512 pixels, retain alpha and remove metadata', async () => {
  const original = await sharp({ create: { width: 1600, height: 1200, channels: 4, background: '#ff900080' } })
    .png().toBuffer();
  const optimized = await optimizeImage(original, { profile: true, extension: 'png' });
  const info = await sharp(optimized).metadata();
  assert.equal(info.format, 'webp'); assert.equal(info.width, 512); assert.equal(info.height, 384);
  assert.equal(info.hasAlpha, true); assert.equal(info.exif, undefined); assert.ok(optimized.length < original.length);
});

test('photo orientation is applied before EXIF is stripped and small images are not enlarged', async () => {
  const original = await sharp({ create: { width: 100, height: 50, channels: 3, background: '#ff9000' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const optimized = await optimizeImage(original, { profile: true, extension: 'jpg' });
  const info = await sharp(optimized).metadata();
  assert.equal(info.width, 50); assert.equal(info.height, 100); assert.equal(info.orientation, undefined);
});

test('image notes keep a readable larger size while documents and animated formats remain untouched', async () => {
  const original = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#ff9000' } }).png().toBuffer();
  const optimized = await optimizeImage(original, { extension: 'png' });
  assert.equal((await sharp(optimized).metadata()).width, 2560);
  assert.equal(await optimizeImage(Buffer.from('original'), { extension: 'gif' }), null);
  assert.equal(await optimizeImage(Buffer.from('original'), { extension: 'tiff' }), null);
});

test('damaged image data fails before it can be uploaded', async () => {
  await assert.rejects(optimizeImage(Buffer.from('broken image'), { profile: true, extension: 'png' }));
});

test('existing public avatar delivery is resized while signed/private/preview URLs are preserved', async () => {
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const { default: profileImage } = await import(pathToFileURL(path.join(__dirname, '../../client/src/utils/profileImage.js')));
  const original = 'https://res.cloudinary.com/test/image/upload/v123/avatar.png';
  assert.equal(profileImage(original, 80), 'https://res.cloudinary.com/test/image/upload/f_auto,q_auto:good,c_limit,w_160,h_160/v123/avatar.png');
  for (const url of ['blob:preview', 'https://example.test/avatar.png',
    'https://res.cloudinary.com/test/image/authenticated/s--signed--/avatar.png',
    'https://res.cloudinary.com/test/image/upload/s--signed--/avatar.png']) assert.equal(profileImage(url), url);
});
