const path = require('path');
if (require.main === module) require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Note = require('../models/Note');
const cloudinary = require('../config/cloudinary');
const { PRIVATE_NOTE_FOLDER, deliveryType } = require('../utils/noteAccess');
const { imageExtensions } = require('../middleware/uploads');
const { reportError } = require('../utils/logger');

// Explicit apply mode is required because this invalidates existing public links.
async function main({ apply = process.argv.includes('--apply'), connect = true } = {}) {
  if (connect) await connectDB();
  let pending = 0;
  let failed = 0;
  for await (const note of Note.find().cursor()) {
    if (deliveryType(note) === 'authenticated') continue;
    pending++;
    console.log(JSON.stringify({ event: apply ? 'securing_note' : 'note_requires_migration', noteId: note._id }));
    if (!apply) continue;
    if (!note.publicId || !/^[a-z0-9]{1,12}$/i.test(note.fileType)) {
      failed++;
      console.log(JSON.stringify({ event: 'note_requires_manual_reupload', noteId: note._id }));
      continue;
    }
    const ext = note.fileType.toLowerCase();
    const resourceType = imageExtensions.has(ext) ? 'image' : 'raw';
    const newId = `${PRIVATE_NOTE_FOLDER}/${note._id}${resourceType === 'raw' ? `.${ext}` : ''}`;
    try {
      // Deterministic IDs allow resuming if storage moved but saving MongoDB failed.
      let asset;
      try {
        asset = await cloudinary.api.resource(newId, { resource_type: resourceType, type: 'authenticated' });
      } catch (error) {
        if (error.http_code !== 404) throw error;
        asset = await cloudinary.uploader.rename(note.publicId, newId, {
          resource_type: resourceType, type: 'upload', to_type: 'authenticated',
          invalidate: true, overwrite: false,
        });
      }
      note.publicId = asset.public_id;
      note.fileUrl = asset.secure_url;
      await note.save();
    } catch (error) {
      failed++;
      reportError(error, 'note_migration_failed');
      console.log(JSON.stringify({ event: 'note_migration_failed', noteId: note._id }));
    }
  }
  console.log(JSON.stringify({ apply, pending, failed }));
  return { apply, pending, failed };
}
if (require.main === module) {
  main().then(({ failed }) => { if (failed) process.exitCode = 1; })
    .catch((error) => { reportError(error, 'note_migration_failed'); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = main;
