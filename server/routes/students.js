const { reportError } = require('../utils/logger');
const express = require('express');
const { body, validationResult } = require('express-validator');
const requireRole = require('../middleware/roles');
const { profileUpload } = require('../middleware/uploads');
const { bodyFields, studentFields, validateId } = require('../middleware/validation');
const Teacher = require('../models/Teacher');
const { uploadStreamToCloudinary } = require('../config/cloudinary');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const { generateRollNumber } = require('../utils/rollNumbers');
const { privateFeeFields, setFeePolicy, adminStudent } = require('../utils/feePolicy');

const router = express.Router();

// All routes require authentication
router.use(auth, requireRole('admin'));
router.param('id', validateId);

// GET /api/students — List all students (populated with teacher info)
router.get('/', async (req, res) => {
  try {
    const students = await Student.find()
      .select(privateFeeFields)
      .populate('assignedTeacher', 'name batchName')
      .sort({ createdAt: -1 });
    res.json(students.map(adminStudent));
  } catch (error) {
    reportError(error, 'get_students_error', req);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/students — Create a student with auto-generated roll number & optional profile picture
router.post(
  '/',
  ...profileUpload,
  bodyFields(studentFields),
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

      const { name, studentClass, assignedTeacher, fees, feesPaid, phone, password, enrollmentDate } = req.body;

      if (!(await Teacher.exists({ _id: assignedTeacher }))) {
        return res.status(400).json({ message: 'Assigned teacher does not exist.' });
      }
      if (Number(feesPaid || 0) > Number(fees)) {
        return res.status(400).json({ message: 'Fees paid cannot exceed total fees.' });
      }

      // Auto-generate roll number
      const rollNumber = await generateRollNumber(studentClass, assignedTeacher);

      let profilePictureUrl = '';
      if (req.file) {
        try {
          const result = await uploadStreamToCloudinary(req.file.buffer, {
            folder: 'myacademy/profiles/students',
          });
          profilePictureUrl = result.secure_url;
        } catch (uploadError) {
          reportError(uploadError, 'cloudinary_student_image_upload_failed', req);
          return res.status(500).json({ message: 'Failed to upload profile picture to cloud storage.' });
        }
      }

      const studentData = {
        rollNumber,
        name,
        studentClass,
        assignedTeacher,
        fees: Number(fees),
        feesPaid: feesPaid !== undefined ? Number(feesPaid) : 0,
        phone,
        password,
        profilePicture: profilePictureUrl,
      };

      // Only set enrollmentDate if explicitly provided, otherwise let schema default apply
      if (enrollmentDate) {
        studentData.enrollmentDate = new Date(enrollmentDate);
      }

      const student = new Student(studentData);
      setFeePolicy(student, req.body.feeExempt);
      await student.save();

      // Populate teacher info before returning
      await student.populate('assignedTeacher', 'name batchName');

      res.status(201).json(adminStudent(student));
    } catch (error) {
      reportError(error, 'create_student_error', req);
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
  ...profileUpload,
  bodyFields(studentFields),
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

      const student = await Student.findById(req.params.id, privateFeeFields);
      if (!student) {
        return res.status(404).json({ message: 'Student not found.' });
      }

      const { name, studentClass, assignedTeacher, fees, feesPaid, phone, password, enrollmentDate } = req.body;

      if (assignedTeacher && !(await Teacher.exists({ _id: assignedTeacher }))) {
        return res.status(400).json({ message: 'Assigned teacher does not exist.' });
      }

      if (name) student.name = name;
      setFeePolicy(student, req.body.feeExempt);
      if (studentClass) student.studentClass = studentClass;
      if (assignedTeacher) student.assignedTeacher = assignedTeacher;
      if (fees !== undefined) student.fees = Number(fees);
      if (feesPaid !== undefined) student.feesPaid = Number(feesPaid);
      if (phone) student.phone = phone;
      if (password) student.password = password;
      if (enrollmentDate) student.enrollmentDate = new Date(enrollmentDate);
      if (student.feesPaid > student.fees) {
        return res.status(400).json({ message: 'Fees paid cannot exceed total fees.' });
      }

      if (req.file) {
        try {
          const result = await uploadStreamToCloudinary(req.file.buffer, {
            folder: 'myacademy/profiles/students',
          });
          student.profilePicture = result.secure_url;
        } catch (uploadError) {
          reportError(uploadError, 'cloudinary_student_image_update_failed', req);
          return res.status(500).json({ message: 'Failed to upload updated profile picture.' });
        }
      }

      await student.save();
      await student.populate('assignedTeacher', 'name batchName');

      res.json(adminStudent(student));
    } catch (error) {
      reportError(error, 'update_student_error', req);
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
    reportError(error, 'delete_student_error', req);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
