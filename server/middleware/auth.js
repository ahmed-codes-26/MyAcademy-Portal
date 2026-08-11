const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || process.env.SESSION_SECRET || 'myacademy_secret_fallback');

    let user;
    const role = decoded.role || 'admin';

    if (role === 'admin') {
      user = await Admin.findById(decoded.id);
    } else if (role === 'teacher') {
      user = await Teacher.findById(decoded.id);
    } else if (role === 'student') {
      user = await Student.findById(decoded.id).populate('assignedTeacher', 'name email');
    }

    if (!user) {
      return res.status(401).json({ message: `Access denied. ${role} not found.` });
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = role;

    // Backward compatibility for existing admin routes
    if (role === 'admin') {
      req.admin = user;
      req.adminId = user._id;
    }

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = auth;
