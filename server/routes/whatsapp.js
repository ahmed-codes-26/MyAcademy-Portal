const express = require('express');
const auth = require('../middleware/auth');
const { getSessionStatus, disconnectSession } = require('../utils/whatsappManager');

const router = express.Router();

// Apply auth middleware to protect all WhatsApp connectivity routes (only accessible by teachers)
router.use(auth);
router.use((req, res, next) => {
  if (req.userRole !== 'teacher') {
    return res.status(403).json({ message: 'Forbidden. Teacher access required.' });
  }
  next();
});

/**
 * GET /api/teacher/whatsapp/status
 * Retrieves current WhatsApp linkage status, phone, and base64 QR code image.
 * Triggers lazy initialization if the session isn't active in memory.
 */
router.get('/status', (req, res) => {
  try {
    const statusInfo = getSessionStatus(req.userId);
    res.json(statusInfo);
  } catch (error) {
    console.error('Fetch WhatsApp status error:', error);
    res.status(500).json({ message: 'Server error retrieving WhatsApp status.' });
  }
});

/**
 * POST /api/teacher/whatsapp/disconnect
 * Logs out and ends the teacher's active socket, and wipes credentials from MongoDB.
 */
router.post('/disconnect', async (req, res) => {
  try {
    await disconnectSession(req.userId);
    res.json({ message: 'WhatsApp session disconnected and logged out successfully.' });
  } catch (error) {
    console.error('Disconnect WhatsApp error:', error);
    res.status(500).json({ message: 'Server error during WhatsApp disconnection.' });
  }
});

module.exports = router;

// Reload trigger nodemon
