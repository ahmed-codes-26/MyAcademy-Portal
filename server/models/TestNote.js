const mongoose = require('mongoose');
const { dateOnly } = require('../middleware/validation');

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  ownerRole: { type: String, enum: ['admin', 'teacher'], required: true, immutable: true },
  date: { type: String, required: true, validate: dateOnly },
  title: { type: String, trim: true, maxlength: 120, default: '' },
  content: { type: String, maxlength: 20000, default: '' },
  pinned: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ owner: 1, ownerRole: 1, pinned: -1, date: -1, createdAt: -1, _id: -1 });

module.exports = mongoose.model('TestNote', schema);
