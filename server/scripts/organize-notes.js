const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');
const cloudinary = require('../config/cloudinary');
const Note = require('../models/Note');
const { noteFolder } = require('../utils/noteStorage');
const { deliveryType } = require('../utils/noteAccess');
const { imageExtensions } = require('../middleware/uploads');

async function main({ apply = false, backupDir = path.join(__dirname, '../backups/cloudinary') } = {}) {
  const config = await cloudinary.api.config({ settings: true });
  if ((config.folder_mode || config.settings?.folder_mode) !== 'dynamic') {
    throw new Error('This URL-preserving organization requires Cloudinary dynamic folder mode. No files were moved.');
  }
  const plan = [];
  const missing = [];
  for await (const note of Note.find().select('class subject uploadedBy publicId fileType displayName').lean().cursor()) {
    if (!note.publicId) { missing.push(String(note._id)); continue; }
    const resourceType = imageExtensions.has(note.fileType.toLowerCase()) ? 'image' : 'raw';
    const type = deliveryType(note);
    let asset;
    try { asset = await cloudinary.api.resource(note.publicId, { resource_type: resourceType, type }); }
    catch (error) { if (error.http_code !== 404) throw error; missing.push(String(note._id)); continue; }
    const folder = noteFolder(note);
    if (asset.asset_folder !== folder) plan.push({ noteId: String(note._id), publicId: note.publicId,
      resourceType, type, before: asset.asset_folder || '', after: folder, displayName: note.displayName });
  }
  let backup;
  if (apply && plan.length) {
    fs.mkdirSync(backupDir, { recursive: true });
    backup = path.join(backupDir, `folders-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify({ createdAt: new Date().toISOString(), plan }, null, 2), { flag: 'wx' });
    for (const item of plan) {
      const result = await cloudinary.api.update(item.publicId, { resource_type: item.resourceType, type: item.type,
        asset_folder: item.after, display_name: item.displayName });
      if (result.public_id !== item.publicId || result.asset_folder !== item.after) {
        throw new Error('Unexpected storage response. Stop and inspect the folder backup before retrying.');
      }
    }
  }
  return { apply, planned: plan.length, updated: apply ? plan.length : 0, missing, backup };
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  // Config is initialized at import time, so apply values after loading the CLI environment.
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET });
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => main({ apply: process.argv.includes('--apply') }))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => { console.error(`Cloudinary organization failed (${error.http_code || error.name}). No asset deletion or URL changes were requested.`); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = main;
