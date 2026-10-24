const path = require('path');
if (require.main === module) require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const WhatsAppSession = require('../models/WhatsAppSession');
const { encryptCredential, PREFIX } = require('../utils/credentialEncryption');
const { reportError } = require('../utils/logger');

async function main({ apply = process.argv.includes('--apply'), connect = true } = {}) {
  if (!process.env.WHATSAPP_AUTH_KEY) throw new Error('Set a permanent WHATSAPP_AUTH_KEY before migration.');
  if (connect) await connectDB();
  let pending = 0;
  for await (const session of WhatsAppSession.find().cursor()) {
    const fields = [['creds', session.creds],
      ...Array.from(session.keys || new Map(), ([key, value]) => [`keys.${key}`, value])];
    for (const [field, value] of fields) {
      if (!value || value.startsWith(PREFIX)) continue;
      pending++;
      if (apply) {
        // Compare-and-set avoids overwriting a concurrent credential refresh.
        await WhatsAppSession.updateOne({ _id: session._id, [field]: value },
          { $set: { [field]: encryptCredential(value) } });
      }
    }
  }
  console.log(JSON.stringify({ apply, legacyFieldsFound: pending }));
  return { apply, legacyFieldsFound: pending };
}
if (require.main === module) {
  main().catch((error) => { reportError(error, 'credential_migration_failed'); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = main;
