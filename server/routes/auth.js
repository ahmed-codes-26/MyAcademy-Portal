const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const PasswordRequest = require('../models/PasswordRequest');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, identifier, role: requestedRole } = req.body;
    const loginId = (identifier || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Please provide identifier/email and password.' });
    }

    let user = null;
    let role = requestedRole || 'admin';

    // 1. If explicit role is student or loginId is not an email format
    if (requestedRole === 'student' || !loginId.includes('@')) {
      const formattedRegNo = loginId.toUpperCase();
      user = await Student.findOne({ rollNumber: formattedRegNo }).populate('assignedTeacher', 'name email');
      if (user) {
        role = 'student';
      }
    }

    // 2. Try Admin collection
    if (!user && (requestedRole === 'admin' || !requestedRole)) {
      user = await Admin.findOne({ email: loginId.toLowerCase() });
      if (user) role = 'admin';
    }

    // 3. Try Teacher collection
    if (!user && (requestedRole === 'teacher' || !requestedRole)) {
      user = await Teacher.findOne({ email: loginId.toLowerCase() });
      if (user) role = 'teacher';
    }

    // 4. Fallback search across all collections
    if (!user) {
      user = await Student.findOne({ rollNumber: loginId.toUpperCase() }).populate('assignedTeacher', 'name email');
      if (user) {
        role = 'student';
      } else {
        user = await Admin.findOne({ email: loginId.toLowerCase() });
        if (user) role = 'admin';
        else {
          user = await Teacher.findOne({ email: loginId.toLowerCase() });
          if (user) role = 'teacher';
        }
      }
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid registration number / email or password.' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid registration number / email or password.' });
    }

    // Generate JWT with role
    const token = jwt.sign(
      { id: user._id, role },
      process.env.JWT_SECRET || process.env.SESSION_SECRET || 'myacademy_secret_fallback',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: { ...user.toJSON(), role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during authentication.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { identifier, message } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).json({ message: 'Please provide your roll number or email.' });
    }

    const request = await PasswordRequest.create({
      identifier: identifier.trim(),
      message: message || '',
      status: 'pending',
    });

    res.status(201).json({
      message: 'Password reset request submitted successfully. The admin will review it shortly.',
      request,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
