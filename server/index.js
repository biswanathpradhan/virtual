const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const initDatabase = require('./config/initDatabase');
const authRoutes = require('./routes/auth');
const roomRoutes = require('./routes/rooms');
const callRoutes = require('./routes/calls');
const settingsRoutes = require('./routes/settings');
const chatRoutes = require('./routes/chat');
const fileRoutes = require('./routes/files');
const invitationRoutes = require('./routes/invitations');
const profileRoutes = require('./routes/profile');
const { initializeSocket } = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// CORS configuration
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/profile', profileRoutes);

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // Handle React routing - return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Virtual Office API is running' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    // Initialize database tables
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialized successfully');

    // Test database connection
    const connection = await db.getConnection();
    console.log('Database connected successfully');
    connection.release();

    // Initialize Socket.IO
    initializeSocket(io);

    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Virtual Office API ready at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

