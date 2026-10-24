const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const createApp = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  createApp().listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
