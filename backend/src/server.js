const http = require('http');
const app = require('./app');
const config = require('./config/index');
const logger = require('./utils/logger');
const database = require('./config/database');
const redisService = require('./services/redisService');
const firebaseService = require('./services/firebaseService');
const { initializeSocketIO } = require('./sockets/index');
const mqttConsumer = require('./mqtt/consumer');
const { startJobs } = require('./jobs/delayDetection');

const server = http.createServer(app);

// ── Initialize Services ───────────────────────────────────────────
async function initializeServices() {
  const services = [];

  // 1. Database
  services.push(
    database.connect()
      .then(() => logger.info('✓ MongoDB connected'))
      .catch(err => logger.warn('✗ MongoDB not available:', err.message))
  );

  // 2. Redis
  services.push(
    redisService.connect()
      .then(() => logger.info('✓ Redis connected'))
      .catch(err => logger.warn('✗ Redis not available:', err.message))
  );

  // 3. Firebase (optional)
  services.push(
    firebaseService.initialize()
      .then(() => logger.info('✓ Firebase initialized'))
      .catch(err => logger.warn('✗ Firebase not available:', err.message))
  );

  await Promise.allSettled(services);
}

// ── Start Server ──────────────────────────────────────────────────
async function startServer() {
  try {
    // Step 1: Initialize essential services
    await initializeServices();

    // Step 2: Initialize Socket.IO with Redis adapter
    const io = await initializeSocketIO(server);
    logger.info('✓ Socket.IO initialized');

    // Step 3: Connect MQTT Consumer and attach Socket.IO
    try {
      await mqttConsumer.connect();
      mqttConsumer.setSocketIO(io);
      logger.info('✓ MQTT Consumer connected');
    } catch (mqttError) {
      logger.warn('✗ MQTT not available:', mqttError.message);
    }

    // Step 4: Start scheduled jobs
    try {
      startJobs();
      logger.info('✓ Scheduled jobs started');
    } catch (jobsError) {
      logger.warn('✗ Scheduled jobs failed:', jobsError.message);
    }

    // Step 5: Start listening
    server.listen(config.port, config.host, () => {
      logger.info(`
╔══════════════════════════════════════════════════════════════╗
║              SmartTransit AI - Server Started                ║
╠══════════════════════════════════════════════════════════════╣
║  Environment : ${config.env.padEnd(35)}║
║  Port        : ${String(config.port).padEnd(35)}║
║  Host        : ${config.host.padEnd(35)}║
║  MongoDB     : ${database.isConnected ? 'Connected'.padEnd(30) : 'Not Available'.padEnd(30)}║
║  Redis       : ${redisService.isConnected ? 'Connected'.padEnd(30) : 'Not Available'.padEnd(30)}║
║  MQTT        : ${mqttConsumer.isConnected ? 'Connected'.padEnd(30) : 'Not Available'.padEnd(30)}║
║  Socket.IO   : Ready${' '.repeat(30)}║
║  Firebase    : ${firebaseService.initialized ? 'Ready'.padEnd(30) : 'Not Configured'.padEnd(30)}║
╚══════════════════════════════════════════════════════════════╝
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

    // Disconnect services in parallel
    await Promise.allSettled([
      mqttConsumer.disconnect().catch(() => {}),
      redisService.disconnect().catch(() => {}),
      database.disconnect().catch(() => {}),
    ]);

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

// ── Start ─────────────────────────────────────────────────────────
startServer();

// Export for testing
module.exports = { app, server };
