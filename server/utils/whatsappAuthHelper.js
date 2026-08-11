const WhatsAppSession = require('../models/WhatsAppSession');
const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');

const useMongoDBAuthState = async (teacherId) => {
  const teacherIdStr = teacherId.toString();

  // Find existing session or initialize a new one
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
          // Always read the latest keys from the database to prevent stale reads
          const currentSession = await WhatsAppSession.findOne({ teacherId: teacherIdStr });
          const data = {};
          if (currentSession && currentSession.keys) {
            for (const id of ids) {
              const key = `${type}-${id}`;
              const serialized = currentSession.keys.get(key);
              if (serialized) {
                try {
                  data[id] = JSON.parse(serialized, BufferJSON.reviver);
                } catch (err) {
                  console.error(`Failed to parse session key ${key}:`, err.message);
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
              const key = `keys.${type}-${id}`;
              if (value) {
                updateFields[key] = JSON.stringify(value, BufferJSON.replacer);
                hasUpdates = true;
              } else {
                unsetFields[key] = "";
                hasUnsets = true;
              }
            }
          }

          const updateOp = {};
          if (hasUpdates) updateOp.$set = updateFields;
          if (hasUnsets) updateOp.$unset = unsetFields;

          if (hasUpdates || hasUnsets) {
            try {
              // Perform atomic updates directly in MongoDB to prevent document version conflicts or DocumentNotFoundError on logout
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
        // Perform atomic update for credentials
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
