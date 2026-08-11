const mongoose = require('mongoose');

const passwordRequestSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: [true, 'Roll number or email is required'],
      trim: true,
    },
    message: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'resolved'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PasswordRequest', passwordRequestSchema);
