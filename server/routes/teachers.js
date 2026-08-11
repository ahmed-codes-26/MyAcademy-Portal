const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Teacher = require('../models/Teacher');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/teachers — List all teachers
router.get('/', async (req, res) => {
  try {
    const teachers = await Teacher.find().sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/teachers — Create a teacher
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('batchName').trim().notEmpty().withMessage('Batch name is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const { name, phone, email, batchName, password } = req.body;
      const teacher = await Teacher.create({ name, phone, email, batchName, password });

      res.status(201).json(teacher);
    } catch (error) {
      console.error('Create teacher error:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// PUT /api/teachers/:id — Update a teacher
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('batchName').optional().trim().notEmpty().withMessage('Batch name cannot be empty'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const teacher = await Teacher.findById(req.params.id);
      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found.' });
      }

      const { name, phone, email, batchName, password } = req.body;

      if (name) teacher.name = name;
      if (phone) teacher.phone = phone;
      if (email) teacher.email = email;
      if (batchName) teacher.batchName = batchName;
      if (password) teacher.password = password;

      await teacher.save();

      res.json(teacher);
    } catch (error) {
      console.error('Update teacher error:', error);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// DELETE /api/teachers/:id — Delete a teacher
router.delete('/:id', async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndDelete(req.params.id);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found.' });
    }
    res.json({ message: 'Teacher deleted successfully.' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
