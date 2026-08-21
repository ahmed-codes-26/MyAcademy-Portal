const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    class: {
      type: String,
      required: [true, 'Class grade level is required (e.g. 9th, 10th)'],
      trim: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      enum: {
        values: ['English', 'Urdu', 'Math', 'Islamiyat', 'Pakistan Studies', 'Chemistry', 'Physics', 'History', 'Geography', 'G Science'],
        message: '{VALUE} is not a valid subject',
      },
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Uploaded by teacher reference is required'],
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL from Cloudinary is required'],
    },
    publicId: {
      type: String,
      required: [true, 'Cloudinary public ID is required'],
    },
    fileSize: {
      type: String,
      required: [true, 'Formatted file size is required (e.g. 1.2 MB)'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    fileType: {
      type: String,
      default: 'raw',
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Note', noteSchema);
