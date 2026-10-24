const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { jwtSecret, jwtIssuer, jwtAudience } = require('../config/security');
const { matchesCredentials } = require('../utils/tokens');
const { objectId } = require('./validation');
const { userLimiter } = require('./security');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'], issuer: jwtIssuer, audience: jwtAudience,
    });
    if (!decoded || !objectId(decoded.id) || !['admin', 'teacher', 'student'].includes(decoded.role)) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    let user;
    const role = decoded.role;

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

    if (!matchesCredentials(user, decoded.credentialVersion)) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = role;

    // Backward compatibility for existing admin routes
    if (role === 'admin') {
      req.admin = user;
      req.adminId = user._id;
    }

    // Mounted teacher/WhatsApp routers can authenticate the same request twice.
    if (req.securityRateLimited) return next();
    req.securityRateLimited = true;
    return userLimiter(req, res, next);
  } catch (error) {
    if (['JsonWebTokenError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired.' });
    }
    return res.status(500).json({ message: 'Server error.' });
  }
};

module.exports = auth;
