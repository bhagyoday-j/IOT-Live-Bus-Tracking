const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const config = require('../config/index');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Socket.IO Server Setup with Redis Adapter
 * 
 * Architecture:
 * - Uses Redis adapter for horizontal scaling (multiple instances)
 * - JWT authentication on connection
 * - Room-based subscription for bus tracking
 * - Role-based rooms for broadcasting
 * 
 * Rooms:
 *   user:{userId}       - Personal room for individual user notifications
 *   role:{role}         - Role-based room (passenger, depot_manager, admin)
 *   bus:{busId}         - Bus-specific tracking room
 *   depot:{depotId}     - Depot-specific room for managers
 *   route:{routeId}     - Route-specific room
 */

let io = null;
const userSockets = new Map(); // userId -> Set of socket IDs
const busTrackers = new Map(); // busId -> Set of userIds tracking this bus

/**
 * Initialize Socket.IO server with Redis adapter
 * @param {http.Server} server - HTTP server instance
 * @returns {Server} Socket.IO instance
 */
async function initializeSocketIO(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6, // 1MB max message size
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Setup Redis adapter for horizontal scaling
  await setupRedisAdapter();

  // Authentication middleware
  io.use(authenticateSocket);

  // Connection handler
  io.on('connection', handleConnection);

  logger.info('Socket.IO initialized with Redis adapter');
  return io;
}

/**
 * Setup Redis adapter for Socket.IO horizontal scaling
 */
async function setupRedisAdapter() {
  try {
    const pubClient = new Redis(config.redis.url, {
      password: config.redis.password,
      enableAutoPipelining: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      lazyConnect: true,
    });

    pubClient.on('error', (err) => {
      logger.warn('Socket.IO Redis pubClient error:', err.message)
    })
    pubClient.on('close', () => {
      logger.warn('Socket.IO Redis pubClient closed')
    })

    const subClient = pubClient.duplicate();
    subClient.on('error', (err) => {
      logger.warn('Socket.IO Redis subClient error:', err.message)
    })
    subClient.on('close', () => {
      logger.warn('Socket.IO Redis subClient closed')
    })

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter connected');
  } catch (error) {
    logger.warn('Socket.IO Redis adapter not available, running without scaling:', error.message);
    // Fall back to in-memory adapter (single instance only)
  }
}

/**
 * Authenticate socket connections using JWT
 */
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow unauthenticated connection but with limited capabilities
      socket.isAuthenticated = false;
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.userId).select('-password -refreshToken');

    if (!user || !user.isActive) {
      socket.isAuthenticated = false;
      return next();
    }

    // Attach user data to socket
    socket.user = user;
    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.isAuthenticated = true;

    next();
  } catch (error) {
    socket.isAuthenticated = false;
    next();
  }
}

/**
 * Handle new socket connection
 */
function handleConnection(socket) {
  logger.info(`Socket connected: ${socket.id}${socket.isAuthenticated ? ` (${socket.user?.email || socket.userId})` : ' (anonymous)'}`);

  // Track authenticated users
  if (socket.isAuthenticated && socket.userId) {
    addUserSocket(socket.userId, socket.id);

    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);
    socket.join(`user:${socket.userId}`);

    // Join depot room if user is depot manager
    if (socket.user.depotId) {
      socket.join(`depot:${socket.user.depotId}`);
    }

    // Send welcome with connection info
    socket.emit('connected', {
      socketId: socket.id,
      userId: socket.userId,
      role: socket.userRole,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Event Handlers ──────────────────────────────────────────────

  /**
   * Start tracking a specific bus
   */
  socket.on('trackBus', (busId, callback) => {
    if (!busId) {
      if (callback) callback({ error: 'Bus ID is required' });
      return;
    }

    const roomId = `bus:${busId}`;
    socket.join(roomId);

    // Track who is tracking this bus
    if (!busTrackers.has(busId)) {
      busTrackers.set(busId, new Set());
    }
    busTrackers.get(busId).add(socket.id);

    logger.debug(`Socket ${socket.id} tracking bus ${busId}`);
    
    if (callback) callback({ success: true, busId });
  });

  /**
   * Stop tracking a bus
   */
  socket.on('stopTrackingBus', (busId) => {
    if (busId) {
      socket.leave(`bus:${busId}`);
      const trackers = busTrackers.get(busId);
      if (trackers) {
        trackers.delete(socket.id);
        if (trackers.size === 0) busTrackers.delete(busId);
      }
    }
  });

  /**
   * Track all buses in a depot/route
   */
  socket.on('trackDepot', (depotId, callback) => {
    if (!depotId) {
      if (callback) callback({ error: 'Depot ID is required' });
      return;
    }
    socket.join(`depot:${depotId}`);
    if (callback) callback({ success: true, depotId });
  });

  socket.on('trackRoute', (routeId, callback) => {
    if (!routeId) {
      if (callback) callback({ error: 'Route ID is required' });
      return;
    }
    socket.join(`route:${routeId}`);
    if (callback) callback({ success: true, routeId });
  });

  /**
   * Subscribe to notifications
   */
  socket.on('subscribeNotifications', () => {
    if (socket.userId) {
      socket.join(`notifications:${socket.userId}`);
    }
  });

  /**
   * Request ETA for a bus
   */
  socket.on('requestETA', async (busId, callback) => {
    if (!busId || !callback) return;
    try {
      const etaService = require('../services/etaService');
      const Bus = require('../models/Bus');
      const bus = await Bus.findById(busId).populate('routeId');
      if (!bus || !bus.routeId) {
        callback({ error: 'Bus or route not found' });
        return;
      }
      const eta = await etaService.calculateETA(bus, bus.routeId, bus.currentLocation);
      callback({ success: true, eta, busId });
    } catch (error) {
      callback({ error: error.message });
    }
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', (reason) => {
    logger.info(`Socket disconnected: ${socket.id} (${reason})`);

    // Remove from user tracking
    if (socket.userId) {
      removeUserSocket(socket.userId, socket.id);
    }

    // Clean up bus tracking
    for (const [busId, trackers] of busTrackers.entries()) {
      if (trackers.has(socket.id)) {
        trackers.delete(socket.id);
        if (trackers.size === 0) busTrackers.delete(busId);
      }
    }
  });
}

/**
 * Track user socket connections
 */
function addUserSocket(userId, socketId) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socketId);
}

function removeUserSocket(userId, socketId) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) userSockets.delete(userId);
  }
}

/**
 * Check if a user has active socket connections
 */
function isUserOnline(userId) {
  const sockets = userSockets.get(userId);
  return sockets && sockets.size > 0;
}

/**
 * Get number of online users per role
 */
function getOnlineUsersCount() {
  const counts = { passenger: 0, depot_manager: 0, admin: 0, total: 0 };

  // This can be tracked via Socket.IO room sizes
  if (io) {
    const rooms = io.sockets.adapter.rooms;
    for (const [room, sockets] of rooms) {
      if (room.startsWith('role:')) {
        const role = room.replace('role:', '');
        switch (role) {
          case 'passenger': counts.passenger = sockets.size; break;
          case 'depot_manager': counts.depot_manager = sockets.size; break;
          case 'admin': counts.admin = sockets.size; break;
        }
      }
    }
    counts.total = io.engine.clientsCount;
  }

  return counts;
}

/**
 * Get Socket.IO instance
 */
function getIO() {
  return io;
}

module.exports = {
  initializeSocketIO,
  getIO,
  isUserOnline,
  getOnlineUsersCount,
};
