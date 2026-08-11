const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { useMongoDBAuthState } = require('./whatsappAuthHelper');
const WhatsAppSession = require('../models/WhatsAppSession');

// Keep track of active sockets, statuses, and QR codes in-memory
const activeSockets = {};
const sessionStatuses = {}; // 'disconnected' | 'connecting' | 'connected'
const qrCodes = {};
const connectedPhones = {};

// Create a Pino logger locked to 'error' level to avoid terminal flooding
const baileysLogger = pino({ level: 'error' });

/**
 * Initialize a WhatsApp session for a specific teacher
 */
const initWhatsAppSession = async (teacherId) => {
  const teacherIdStr = teacherId.toString();

  // If already connecting or connected, don't re-initialize
  if (activeSockets[teacherIdStr] && sessionStatuses[teacherIdStr] !== 'disconnected') {
    return activeSockets[teacherIdStr];
  }

  sessionStatuses[teacherIdStr] = 'connecting';
  qrCodes[teacherIdStr] = null;

  try {
    const { state, saveCreds } = await useMongoDBAuthState(teacherIdStr);

    const sock = makeWASocket({
      logger: baileysLogger,
      auth: state,
      printQRInTerminal: false, // Ensure we DO NOT print QR in terminal
      defaultQueryTimeoutMs: undefined,
    });

    activeSockets[teacherIdStr] = sock;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrCodes[teacherIdStr] = await QRCode.toDataURL(qr);
          sessionStatuses[teacherIdStr] = 'disconnected'; // Ready to scan
        } catch (err) {
          console.error(`Error generating QR code for teacher ${teacherIdStr}:`, err);
        }
      }

      if (connection === 'connecting') {
        sessionStatuses[teacherIdStr] = 'connecting';
      }

      if (connection === 'open') {
        sessionStatuses[teacherIdStr] = 'connected';
        qrCodes[teacherIdStr] = null;
        
        // Save the linked phone details
        const jid = sock.user.id;
        const rawPhone = jid.split(':')[0] || jid.split('@')[0];
        connectedPhones[teacherIdStr] = rawPhone;
        console.log(`WhatsApp session opened successfully for teacher ${teacherIdStr} (${rawPhone})`);
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode || error?.output?.payload?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`WhatsApp session closed for teacher ${teacherIdStr}. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`);

        // Cleanup current socket ref
        delete activeSockets[teacherIdStr];
        qrCodes[teacherIdStr] = null;

        if (shouldReconnect) {
          // Attempt reconnection
          setTimeout(() => {
            initWhatsAppSession(teacherIdStr).catch(console.error);
          }, 3000);
        } else {
          // Logged out: clean up database credentials completely
          sessionStatuses[teacherIdStr] = 'disconnected';
          delete connectedPhones[teacherIdStr];
          await WhatsAppSession.deleteOne({ teacherId: teacherIdStr });
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
  } catch (error) {
    console.error(`Failed to initialize WhatsApp session for teacher ${teacherIdStr}:`, error);
    sessionStatuses[teacherIdStr] = 'disconnected';
    throw error;
  }
};

/**
 * Get the status of a teacher's WhatsApp connection
 */
const getSessionStatus = (teacherId) => {
  const teacherIdStr = teacherId.toString();
  
  // Lazy initialization: if session does not exist in memory, spin it up in the background
  if (!activeSockets[teacherIdStr] && sessionStatuses[teacherIdStr] !== 'connecting') {
    initWhatsAppSession(teacherIdStr).catch((err) => {
      console.error(`Lazy init failed for teacher ${teacherIdStr}:`, err.message);
    });
  }

  return {
    status: sessionStatuses[teacherIdStr] || 'disconnected',
    qrCode: qrCodes[teacherIdStr] || null,
    phone: connectedPhones[teacherIdStr] || null,
  };
};

/**
 * Safely disconnect WhatsApp, logout, and remove DB credentials
 */
const disconnectSession = async (teacherId) => {
  const teacherIdStr = teacherId.toString();
  const sock = activeSockets[teacherIdStr];

  if (sock) {
    try {
      await sock.logout();
      sock.end();
    } catch (err) {
      console.warn(`Error logging out Baileys socket for teacher ${teacherIdStr}:`, err.message);
      try {
        sock.end();
      } catch {}
    }
  }

  // Cleanup in-memory records
  delete activeSockets[teacherIdStr];
  sessionStatuses[teacherIdStr] = 'disconnected';
  delete qrCodes[teacherIdStr];
  delete connectedPhones[teacherIdStr];

  // Delete credentials from MongoDB
  await WhatsAppSession.deleteOne({ teacherId: teacherIdStr });
  console.log(`WhatsApp credentials deleted and session cleaned up for teacher ${teacherIdStr}`);
};

/**
 * Get active Baileys socket for a teacher
 */
const getWhatsAppSocket = (teacherId) => {
  return activeSockets[teacherId.toString()] || null;
};

module.exports = {
  initWhatsAppSession,
  getSessionStatus,
  disconnectSession,
  getWhatsAppSocket,
};
