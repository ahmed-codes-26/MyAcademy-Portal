const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');
const models = ['Student', 'Attendance', 'FeePayment', 'Note', 'TestNote'].map((name) => require(`../models/${name}`));

mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    for (const model of models) {
      await model.createIndexes();
      const indexes = (await model.listIndexes()).map((index) => index.name);
      console.log(JSON.stringify({ model: model.modelName, indexes }));
    }
  })
  .catch((error) => { console.error(`Index creation failed (${error.code || error.name}). Existing indexes were not dropped.`); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
