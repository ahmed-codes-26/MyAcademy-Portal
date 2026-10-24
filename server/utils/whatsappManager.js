const { reportError } = require('./logger');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { useMongoDBAuthState } = require('./whatsappAuthHelper');
const WhatsAppSession = require('../models/WhatsAppSession');

// Keep track of active sockets, statuses, and QR codes in-memory
const activeSockets = {};
const sessionStatuses = {}; // 'disconnected' | 'connecting' | 'connected'
const qrCodes = {};
const connectedPhones = {};
const reconnectTimers = {};
const isInitializing = {};

// Create a Pino logger locked to 'error' level to avoid terminal flooding
const baileysLogger = pino({ level: 'error',
  redact: ['creds', 'keys', 'qr', 'phone', 'token', '*.creds', '*.keys', '*.qr', '*.phone', '*.token'],
  serializers: { err: (error) => ({ type: error?.name,
    code: typeof error?.code === 'number' ? error.code : undefined }) },
});

/**
 * Initialize a WhatsApp session for a specific teacher
 */
const initWhatsAppSession = async (teacherId) => {
  const teacherIdStr = teacherId.toString();

  // Prevent duplicate concurrent initialization calls for the same teacher
  if (isInitializing[teacherIdStr]) {
    return activeSockets[teacherIdStr] || null;
  }

  // If already connected, return active socket
  if (activeSockets[teacherIdStr] && sessionStatuses[teacherIdStr] === 'connected') {
    return activeSockets[teacherIdStr];
  }

  // Clear any existing reconnect timer
  if (reconnectTimers[teacherIdStr]) {
    clearTimeout(reconnectTimers[teacherIdStr]);
    delete reconnectTimers[teacherIdStr];
  }

  isInitializing[teacherIdStr] = true;
  sessionStatuses[teacherIdStr] = 'connecting';

  try {
    // If an existing socket reference exists, clean up listeners safely
    if (activeSockets[teacherIdStr]) {
      try {
        activeSockets[teacherIdStr].ev.removeAllListeners();
        activeSockets[teacherIdStr].end(undefined);
      } catch (e) {
        // Ignore socket end errors on stale refs
      }
      delete activeSockets[teacherIdStr];
    }

    const { state, saveCreds } = await useMongoDBAuthState(teacherIdStr);

    const sock = makeWASocket({
      logger: baileysLogger,
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'), // Stable browser signature
      syncFullHistory: false,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: undefined,
    });

    activeSockets[teacherIdStr] = sock;

    // Bind credentials update event
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          qrCodes[teacherIdStr] = await QRCode.toDataURL(qr);
          sessionStatuses[teacherIdStr] = 'disconnected'; // Ready for QR scan
        } catch (err) {
          reportError(err, 'error_generating_qr_code_for_teacher');
        }
      }

      if (connection === 'connecting') {
        sessionStatuses[teacherIdStr] = 'connecting';
      }

      if (connection === 'open') {
        sessionStatuses[teacherIdStr] = 'connected';
        qrCodes[teacherIdStr] = null;

        const jid = sock.user?.id || '';
        const rawPhone = jid.split(':')[0] || jid.split('@')[0];
        connectedPhones[teacherIdStr] = rawPhone;
        console.log(`WhatsApp session opened successfully for teacher ${teacherIdStr}`);
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error;
        const statusCode = error?.output?.statusCode || error?.output?.payload?.statusCode;

        console.log(`WhatsApp connection closed for teacher ${teacherIdStr}. Status code: ${statusCode}`);

        if (activeSockets[teacherIdStr] === sock) {
          delete activeSockets[teacherIdStr];
        }

        const isLoggedOut =
          statusCode === DisconnectReason.loggedOut ||
          statusCode === 401 ||
          statusCode === 403;

        if (isLoggedOut) {
          console.error(`WhatsApp session logged out for teacher ${teacherIdStr} (code ${statusCode}). Wiping MongoDB session keys...`);
          sessionStatuses[teacherIdStr] = 'disconnected';
          qrCodes[teacherIdStr] = null;
          delete connectedPhones[teacherIdStr];

          try {
            await WhatsAppSession.deleteOne({ teacherId: teacherIdStr });
            console.log(`Cleaned up logged out MongoDB session for teacher ${teacherIdStr}`);
          } catch (dbErr) {
            reportError(dbErr, 'failed_to_delete_session_record_for_teacher');
          }
        } else {
          // Automatic reconnection for transient disconnects (428, 408, 515, etc.)
          console.log(`Reconnecting WhatsApp session for teacher ${teacherIdStr} in 3 seconds...`);
          sessionStatuses[teacherIdStr] = 'connecting';

          reconnectTimers[teacherIdStr] = setTimeout(() => {
            delete reconnectTimers[teacherIdStr];
            initWhatsAppSession(teacherIdStr).catch((err) => {
              reportError(err, 'reconnection_failed_for_teacher');
            });
          }, 3000);
        }
      }
    });

    return sock;
  } catch (error) {
    reportError(error, 'failed_to_initialize_whatsapp_session_for_teacher');
    sessionStatuses[teacherIdStr] = 'disconnected';
    throw error;
  } finally {
    isInitializing[teacherIdStr] = false;
  }
};

/**
 * Get the status of a teacher's WhatsApp connection
 */
const getSessionStatus = (teacherId) => {
  const teacherIdStr = teacherId.toString();

  // Lazy initialization: if session does not exist in memory, spin it up in the background
  if (
    !activeSockets[teacherIdStr] &&
    sessionStatuses[teacherIdStr] !== 'connecting' &&
    !isInitializing[teacherIdStr] &&
    !reconnectTimers[teacherIdStr]
  ) {
    initWhatsAppSession(teacherIdStr).catch((err) => {
      reportError(err, 'lazy_init_failed_for_teacher');
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

  if (reconnectTimers[teacherIdStr]) {
    clearTimeout(reconnectTimers[teacherIdStr]);
    delete reconnectTimers[teacherIdStr];
  }

  const sock = activeSockets[teacherIdStr];
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      await sock.logout();
      sock.end(undefined);
    } catch (err) {
      reportError(err, 'error_logging_out_baileys_socket_for_teacher');
      try {
        sock.end(undefined);
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

