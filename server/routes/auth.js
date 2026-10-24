const { reportError } = require('../utils/logger');
const express = require('express');
const { issueToken } = require('../utils/tokens');
const { loginLimiter, accountLoginLimiter, recoveryLimiter } = require('../middleware/security');
const { bodyFields, text } = require('../middleware/validation');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const PasswordRequest = require('../models/PasswordRequest');

const router = express.Router();

// POST /api/auth/login
router.post('/login', loginLimiter, accountLoginLimiter,
  bodyFields({ identifier: text(254), email: text(254), password: text(1024),
    role: (value) => ['admin', 'teacher', 'student'].includes(value) }), async (req, res) => {
  try {
    const { email, password, identifier, role: requestedRole } = req.body;
    const loginId = (identifier || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Please provide identifier/email and password.' });
    }

    let user = null;
    let role;
    // A selected panel only authenticates its own account type.
    // Clients without a role retain the legacy automatic lookup.
    for (const candidate of requestedRole ? [requestedRole] : ['admin', 'teacher', 'student']) {
      if (candidate === 'student') {
        user = await Student.findOne({ rollNumber: loginId.toUpperCase() }).populate('assignedTeacher', 'name email');
      } else {
        const Model = candidate === 'admin' ? Admin : Teacher;
        user = await Model.findOne({ email: loginId.toLowerCase() });
      }
      if (user) { role = candidate; break; }
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
    const token = issueToken(user, role);

    res.set('Cache-Control', 'no-store');
    res.json({
      token,
      admin: { ...user.toJSON(), role },
    });
  } catch (error) {
    reportError(error, 'login_error', req);
    res.status(500).json({ message: 'Server error during authentication.' });
  }
});

// Renew only an unexpired session whose account and password are still valid.
router.post('/refresh', require('../middleware/auth'), (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ token: issueToken(req.user, req.userRole), admin: { ...req.user.toJSON(), role: req.userRole } });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', recoveryLimiter,
  bodyFields({ identifier: text(254), message: text(2000) }), async (req, res) => {
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
    reportError(error, 'forgot_password_error', req);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
