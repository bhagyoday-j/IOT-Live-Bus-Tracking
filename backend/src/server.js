const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const config = require('./config/index');
const logger = require('./utils/logger');
const database = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/index');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: logger.stream }));
app.use('/api', apiLimiter);

// ── Static files (if needed for production frontend) ──────────────
const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// ── API Routes ─────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── SPA fallback (serve index.html for any non-API route) ─────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// ── Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

// ── Socket.IO Events ──────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    const jwt = require('jsonwebtoken');
    const User = require('./models/User');
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id} (${socket.user?.email || 'unknown'})`);

  // Join user to their role-based room
  if (socket.user) {
    socket.join(`user:${socket.user._id}`);
    socket.join(`role:${socket.user.role}`);
  }

  // Join bus tracking room
  socket.on('trackBus', (busId) => {
    socket.join(`bus:${busId}`);
    logger.debug(`Socket ${socket.id} tracking bus ${busId}`);
  });

  socket.on('stopTrackingBus', (busId) => {
    socket.leave(`bus:${busId}`);
  });

  // GPS location updates from devices
  socket.on('busLocationUpdated', (data) => {
    // Broadcast to all users tracking this bus
    io.to(`bus:${data.busId}`).emit('busLocationUpdated', data);
    // Also broadcast to depot managers
    io.to('role:depot_manager').emit('busLocationUpdated', data);
    io.to('role:admin').emit('busLocationUpdated', data);
  });

  // Status changes
  socket.on('busStatusChanged', (data) => {
    io.emit('busStatusChanged', data);
  });

  socket.on('busDelayed', (data) => {
    io.emit('busDelayed', data);
  });

  socket.on('busCancelled', (data) => {
    io.emit('busCancelled', data);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

// ── Start Server ───────────────────────────────────────────────────
async function startServer() {
  try {
    // Try connecting to MongoDB
    try {
      await database.connect();
      logger.info('MongoDB connection established');
    } catch (dbError) {
      logger.warn('MongoDB not available, running without database:', dbError.message);
      logger.info('The server will still start but database-dependent features will not work.');
    }

    server.listen(config.port, config.host, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════╗
║              SmartTransit AI API Server                  ║
╠══════════════════════════════════════════════════════════╣
║  Environment : ${config.env.padEnd(35)}║
║  Port        : ${String(config.port).padEnd(35)}║
║  Host        : ${config.host.padEnd(35)}║
║  MongoDB     : ${database.isConnected ? 'Connected'.padEnd(30) : 'Not Available'.padEnd(30)}║
║  Socket.IO   : Ready${' '.repeat(30)}║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────────
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Received shutdown signal. Starting graceful shutdown...');

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close database connection
    try {
      await database.disconnect();
    } catch (err) {
      logger.error('Error disconnecting database:', err.message);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

startServer();

module.exports = { app, server, io };
