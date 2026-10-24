const mongoose = require('mongoose');
const dns = require('dns');
const { reportError } = require('../utils/logger');
let connectionPromise;
const poolOptions = { maxPoolSize: 20, minPoolSize: 0, maxIdleTimeMS: 60000,
  waitQueueTimeoutMS: 5000, serverSelectionTimeoutMS: 10000 };

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;
  connectionPromise = connect();
  try { return await connectionPromise; }
  finally { connectionPromise = null; }
};

async function connect() {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, poolOptions);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    if (error.message.includes('querySrv') || error.message.includes('ECONNREFUSED')) {
      console.warn('Mongoose querySrv connection failed. Applying Windows DNS fallback...');
      try {
        const defaultServers = dns.getServers();
        const fallbackServers = Array.from(new Set([...defaultServers, '8.8.8.8', '1.1.1.1']));
        dns.setServers(fallbackServers);
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, poolOptions);
        console.log(`MongoDB Connected (DNS fallback): ${conn.connection.host}`);
        return;
      } catch (retryError) {
        reportError(retryError, 'mongodb_connection_fallback_failed');
        process.exit(1);
      }
    }
    reportError(error, 'mongodb_connection_failed');
    process.exit(1);
  }
}

module.exports = connectDB;
