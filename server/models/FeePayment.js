const mongoose = require('mongoose');

const feePaymentSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: [true, 'Student reference is required'],
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Teacher reference is required'],
    },
    month: {
      type: Number,
      required: [true, 'Month is required (0-11)'],
      min: 0,
      max: 11,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'submitted'],
      default: 'pending',
      required: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to ensure one fee status record per student per billing cycle
feePaymentSchema.index({ student: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('FeePayment', feePaymentSchema);
