const mongoose = require('mongoose');

const whatsappSessionSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
      unique: true,
      index: true,
    },
    creds: {
      type: String,
      default: '',
    },
    keys: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WhatsAppSession', whatsappSessionSchema);
