const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { uploadStreamToCloudinary } = require('../config/cloudinary');
const auth = require('../middleware/auth');
const Admin = require('../models/Admin');
const PasswordRequest = require('../models/PasswordRequest');

const router = express.Router();

// Multer config — store in memory for Cloudinary upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// GET /api/admin/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({ message: 'Profile not found.' });
    }
    res.json({ ...user.toJSON(), role: req.userRole });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/admin/profile
router.put(
  '/profile',
  auth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Invalid email'),
    body('phone').optional().trim(),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
      }

      const admin = await Admin.findById(req.adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found.' });
      }

      const { name, email, phone, password } = req.body;

      if (name) admin.name = name;
      if (email) admin.email = email;
      if (phone !== undefined) admin.phone = phone;
      if (password) admin.password = password;

      await admin.save();

      res.json({ message: 'Profile updated successfully.', admin: admin.toJSON() });
    } catch (error) {
      console.error('Update profile error:', error);
      if (error.code === 11000) {
        return res.status(400).json({ message: 'Email already in use.' });
      }
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// POST /api/admin/profile/picture
router.post('/profile/picture', auth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    // Upload to Cloudinary from memory buffer
    const result = await uploadStreamToCloudinary(req.file.buffer, {
      folder: 'myacademy/profiles',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    });

    const admin = await Admin.findById(req.adminId);
    admin.profilePicture = result.secure_url;
    await admin.save();

    res.json({
      message: 'Profile picture updated successfully.',
      profilePicture: result.secure_url,
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Failed to upload image.' });
  }
});

// GET /api/admin/password-requests
router.get('/password-requests', auth, async (req, res) => {
  try {
    const requests = await PasswordRequest.find()
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Get password requests error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// PUT /api/admin/password-requests/:id/resolve
router.put('/password-requests/:id/resolve', auth, async (req, res) => {
  try {
    const request = await PasswordRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Password request not found.' });
    }

    request.status = 'resolved';
    await request.save();

    res.json({ message: 'Password request marked as resolved.', request });
  } catch (error) {
    console.error('Resolve password request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

// DELETE /api/admin/password-requests/:id
router.delete('/password-requests/:id', auth, async (req, res) => {
  try {
    const request = await PasswordRequest.findByIdAndDelete(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Password request not found.' });
    }
    res.json({ message: 'Password request deleted.' });
  } catch (error) {
    console.error('Delete password request error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
