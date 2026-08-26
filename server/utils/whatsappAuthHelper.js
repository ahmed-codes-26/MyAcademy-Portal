const WhatsAppSession = require('../models/WhatsAppSession');
const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

/**
 * Custom MongoDB Auth State handler for Baileys WhatsApp sessions.
 * Ensures buffer serialization/deserialization via BufferJSON and
 * escapes dot characters in keys to prevent MongoDB path collision errors.
 */
const useMongoDBAuthState = async (teacherId) => {
  const teacherIdStr = teacherId.toString();

  // Find existing session or initialize a new document
  let session = await WhatsAppSession.findOne({ teacherId: teacherIdStr });
  if (!session) {
    session = new WhatsAppSession({
      teacherId: teacherIdStr,
      creds: '',
      keys: new Map(),
    });
    await session.save();
  }

  // Load and deserialize credentials
  let creds;
  if (session.creds) {
    try {
      creds = JSON.parse(session.creds, BufferJSON.reviver);
    } catch (err) {
      console.error(`Failed to parse WhatsApp creds for teacher ${teacherIdStr}, resetting:`, err.message);
      creds = initAuthCreds();
    }
  } else {
    creds = initAuthCreds();
  }

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const currentSession = await WhatsAppSession.findOne({ teacherId: teacherIdStr }).lean();
          const data = {};
          if (currentSession && currentSession.keys) {
            const rawKeys = currentSession.keys;
            for (const id of ids) {
              const rawKey = `${type}-${id}`;
              const safeKey = rawKey.replace(/\./g, '__dot__');
              const serialized = rawKeys instanceof Map
                ? (rawKeys.get(safeKey) || rawKeys.get(rawKey))
                : (rawKeys[safeKey] || rawKeys[rawKey]);

              if (serialized) {
                try {
                  data[id] = JSON.parse(serialized, BufferJSON.reviver);
                } catch (err) {
                  console.error(`Failed to parse session key ${rawKey}:`, err.message);
                }
              }
            }
          }
          return data;
        },
        set: async (data) => {
          const updateFields = {};
          const unsetFields = {};
          let hasUpdates = false;
          let hasUnsets = false;

          for (const type in data) {
            for (const id in data[type]) {
              const value = data[type][id];
              const rawKey = `${type}-${id}`;
              const safeKey = rawKey.replace(/\./g, '__dot__');
              const mongoField = `keys.${safeKey}`;

              if (value !== null && value !== undefined) {
                updateFields[mongoField] = JSON.stringify(value, BufferJSON.replacer);
                hasUpdates = true;
              } else {
                unsetFields[mongoField] = '';
                hasUnsets = true;
              }
            }
          }

          const updateOp = {};
          if (hasUpdates) updateOp.$set = updateFields;
          if (hasUnsets) updateOp.$unset = unsetFields;

          if (hasUpdates || hasUnsets) {
            try {
              await WhatsAppSession.updateOne({ teacherId: teacherIdStr }, updateOp);
            } catch (err) {
              console.error(`Failed to save keys update in MongoDB for teacher ${teacherIdStr}:`, err.message);
            }
          }
        },
      },
    },
    saveCreds: async () => {
      try {
        const serializedCreds = JSON.stringify(creds, BufferJSON.replacer);
        await WhatsAppSession.updateOne(
          { teacherId: teacherIdStr },
          { $set: { creds: serializedCreds } }
        );
      } catch (err) {
        console.error(`Failed to save creds update in MongoDB for teacher ${teacherIdStr}:`, err.message);
      }
    },
  };
};

module.exports = { useMongoDBAuthState };

