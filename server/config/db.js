const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      console.warn('Mongoose querySrv connection failed. Applying Windows DNS fallback...');
      try {
        const defaultServers = dns.getServers();
        const fallbackServers = Array.from(new Set([...defaultServers, '8.8.8.8', '1.1.1.1']));
        dns.setServers(fallbackServers);
        
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected (DNS fallback): ${conn.connection.host}`);
        return;
      } catch (retryError) {
        console.error(`MongoDB Connection Error (DNS fallback failed): ${retryError.message}`);
        process.exit(1);
      }
    }
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
