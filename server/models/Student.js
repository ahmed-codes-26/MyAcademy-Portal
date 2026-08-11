const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema(
  {
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    studentClass: {
      type: String,
      required: [true, 'Class is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{1,2}$/.test(v);
        },
        message: 'Class must be a 1 or 2 digit number',
      },
    },
    assignedTeacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: [true, 'Assigned teacher is required'],
    },
    fees: {
      type: Number,
      required: [true, 'Fees amount is required'],
      min: [0, 'Fees cannot be negative'],
    },
    feesPaid: {
      type: Number,
      default: 0,
      min: [0, 'Fees paid cannot be negative'],
      validate: {
        validator: function (v) {
          return v <= this.fees;
        },
        message: 'Fees paid cannot exceed total fees',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    enrollmentDate: {
      type: Date,
      default: Date.now,
    },
    profilePicture: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Hash password and normalize enrollmentDate before saving
studentSchema.pre('save', async function (next) {
  if (this.enrollmentDate) {
    const d = new Date(this.enrollmentDate);
    d.setUTCHours(0, 0, 0, 0);
    this.enrollmentDate = d;
  }
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
studentSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON
studentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Student', studentSchema);
