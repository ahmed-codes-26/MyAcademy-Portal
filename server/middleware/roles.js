module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.userRole)) {
    return res.status(403).json({ message: 'Forbidden. You do not have permission for this action.' });
  }
  next();
};
