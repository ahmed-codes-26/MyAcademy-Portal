const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { uploadStreamToCloudinary } = require('../config/cloudinary');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const Counter = require('../models/Counter');

const router = express.Router();

// Multer memory storage for student profile pictures
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
});

// All routes require authentication
router.use(auth);

/**
 * Generate a unique roll number for a student.
 * Formula: MA + Session(2 digits) + Class(2 digits) + Enrollment(2 digits)
 * Example: MA260906 (Session 2026, Class 09, 6th enrollment)
 */
async function generateRollNumber(studentClass) {
  const year = new Date().getFullYear();
  const session = String(year % 100).padStart(2, '0');
  const cls = String(studentClass).padStart(2, '0');

  // Atomically increment the enrollment counter for this session year
  const counter = await Counter.findOneAndUpdate(
    { _id: `enrollment_${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  const enrollment = String(counter.seq).padStart(2, '0');
  return `MA${session}${cls}${enrollment}`;
}

// GET /api/students — List all students (populated with teacher info)
router.get('/', async (req, res) => {
  try {
    const students = await Student.find()
      .populate('assignedTeacher', 'name batchName')
      .sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/students — Create a student with auto-generated roll number & optional profile picture
router.post(
  '/',
  upload.single('profilePicture'),
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('studentClass')
      .trim()
      .notEmpty()
      .withMessage('Class is required')
      .matches(/^\d{1,2}$/)
      .withMessage('Class must be a 1 or 2 digit number'),
    body('assignedTeacher').notEmpty().withMessage('Assigned teacher is required'),
    body('fees').isNumeric().withMessage('Fees must be a number'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { name, studentClass, assignedTeacher, fees, feesPaid, phone, password } = req.body;

      // Auto-generate roll number
      const rollNumber = await generateRollNumber(studentClass);

      let profilePictureUrl = '';
      if (req.file) {
        try {
          const result = await uploadStreamToCloudinary(req.file.buffer, {
            folder: 'myacademy_students',
          });
          profilePictureUrl = result.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary student image upload failed:', uploadError);
          return res.status(500).json({ message: 'Failed to upload profile picture to cloud storage.' });
        }
      }

      const student = await Student.create({
        rollNumber,
        name,
        studentClass,
        assignedTeacher,
        fees: Number(fees),
        feesPaid: feesPaid !== undefined ? Number(feesPaid) : 0,
        phone,
        password,
        profilePicture: profilePictureUrl,
      });

      // Populate teacher info before returning
      await student.populate('assignedTeacher', 'name batchName');

      res.status(201).json(student);
    } catch (error) {
      console.error('Create student error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Roll number conflict. Please try again.' });
      }
      res.status(500).json({ message: 'Server error creating student.' });
    }
  }
);

// PUT /api/students/:id — Update a student (roll number is immutable)
router.put(
  '/:id',
  upload.single('profilePicture'),
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('studentClass')
      .optional()
      .trim()
      .matches(/^\d{1,2}$/)
      .withMessage('Class must be a 1 or 2 digit number'),
    body('assignedTeacher').optional().notEmpty().withMessage('Assigned teacher is required'),
    body('fees').optional().isNumeric().withMessage('Fees must be a number'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const student = await Student.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: 'Student not found.' });
      }

      const { name, studentClass, assignedTeacher, fees, feesPaid, phone, password } = req.body;

      if (name) student.name = name;
      if (studentClass) student.studentClass = studentClass;
      if (assignedTeacher) student.assignedTeacher = assignedTeacher;
      if (fees !== undefined) student.fees = Number(fees);
      if (feesPaid !== undefined) student.feesPaid = Number(feesPaid);
      if (phone) student.phone = phone;
      if (password) student.password = password;

      if (req.file) {
        try {
          const result = await uploadStreamToCloudinary(req.file.buffer, {
            folder: 'myacademy_students',
          });
          student.profilePicture = result.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary student image update failed:', uploadError);
          return res.status(500).json({ message: 'Failed to upload updated profile picture.' });
        }
      }

      await student.save();
      await student.populate('assignedTeacher', 'name batchName');

      res.json(student);
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ message: 'Server error updating student.' });
    }
  }
);

// DELETE /api/students/:id — Delete a student
router.delete('/:id', async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }
    res.json({ message: 'Student deleted successfully.' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
