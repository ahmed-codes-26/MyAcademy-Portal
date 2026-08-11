const path = require('path');
const dotenvConfig = require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

// Route imports
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teachersCrudRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const teacherRoutes = require('./routes/teacher');
const notesRoutes = require('./routes/notes');
const whatsappRoutes = require('./routes/whatsapp');
const studentPortalRoutes = require('./routes/student');

const app = express();
const PORT = dotenvConfig.parsed?.PORT || process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://myacademy-portal-1.onrender.com'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teachers', teachersCrudRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/teacher/whatsapp', whatsappRoutes);
app.use('/api/student', studentPortalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

// Connect to DB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

// Trigger reload for student portal & auth features
