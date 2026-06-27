const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected successfully');
}).catch(err => {
  console.log('MongoDB connection error:', err);
});

// Import Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workerRoutes = require('./routes/workers');
const opportunityRoutes = require('./routes/opportunities');
const messageRoutes = require('./routes/messages');
const ratingRoutes = require('./routes/ratings');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ratings', ratingRoutes);

// Socket.io Connection for Messaging and Notifications
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Join user to their personal room
  socket.on('join-user', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle sending messages
  socket.on('send-message', (data) => {
    const { senderId, receiverId, message } = data;
    io.to(`user-${receiverId}`).emit('receive-message', {
      senderId,
      message,
      timestamp: new Date()
    });
  });

  // Handle opportunity notifications
  socket.on('notify-workers', (data) => {
    const { workerIds, opportunityData } = data;
    workerIds.forEach(workerId => {
      io.to(`user-${workerId}`).emit('new-opportunity', opportunityData);
    });
  });

  // Handle availability status update
  socket.on('availability-update', (data) => {
    const { userId, isAvailable } = data;
    io.emit('worker-status-update', { userId, isAvailable });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Basic route
app.get('/', (req, res) => {
  res.send('Skill Hub API Server Running');
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
