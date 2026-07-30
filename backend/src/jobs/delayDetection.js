const cron = require('node-cron');
const delayDetectionService = require('../services/delayDetectionService');
const firebaseService = require('../services/firebaseService');
const logger = require('../utils/logger');

let isRunning = false;

/**
 * Start scheduled jobs for the SmartTransit system
 * 
 * Jobs:
 *   - Every 2 minutes: Check all active buses for delays
 *   - Every hour: Clean up old location data
 *   - Every 5 minutes: Recalculate ETAs for active buses
 *   - Every day at midnight: Generate daily analytics snapshots
 */
function startJobs() {
  logger.info('Starting scheduled jobs...');

  // ── Delay Detection: Every 2 minutes ────────────────────────────
  cron.schedule('*/2 * * * *', async () => {
    if (isRunning) {
      logger.debug('Delay detection job skipped - previous run still in progress');
      return;
    }

    isRunning = true;
    try {
      logger.debug('Running delay detection check...');
      const delays = await delayDetectionService.checkAllActiveBuses();

      if (delays.length > 0) {
        logger.info(`Delay detection: Found ${delays.length} bus(es) with delays/issues`);
        
        // Send Firebase push notifications for significant delays
        for (const delay of delays) {
          if (delay.delay >= delayDetectionService.SIGNIFICANT_DELAY_MINUTES) {
            try {
              await firebaseService.sendDelayNotification(
                [], // FCM tokens would come from user subscriptions
                delay.busNumber,
                delay.routeName,
                delay.delay
              );
            } catch (fbError) {
              logger.error('Firebase notification error:', fbError.message);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Delay detection job error:', error.message);
    } finally {
      isRunning = false;
    }
  });

  // ── Cleanup Old Location Data: Every hour ───────────────────────
  cron.schedule('0 * * * *', async () => {
    try {
      const BusLocation = require('../models/BusLocation');
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const result = await BusLocation.deleteMany({ timestamp: { $lt: cutoff } });
      logger.info(`Cleanup: Removed ${result.deletedCount} old location records`);
    } catch (error) {
      logger.error('Cleanup job error:', error.message);
    }
  });

  // ── ETA Recalculation: Every 5 minutes ──────────────────────────
  cron.schedule('*/5 * * * *', async () => {
    try {
      const Bus = require('../models/Bus');
      const etaService = require('../services/etaService');
      const { getIO } = require('../sockets/index');

      const activeBuses = await Bus.find({
        status: { $in: ['on-route', 'delayed'] },
        isActive: true,
        'currentLocation.lat': { $exists: true },
      }).populate('routeId');

      for (const bus of activeBuses) {
        if (bus.routeId && bus.currentLocation?.lat) {
          try {
            const eta = await etaService.calculateETA(bus, bus.routeId, bus.currentLocation);
            
            // Emit updated ETA to tracking clients
            const io = getIO();
            if (io) {
              io.to(`bus:${bus._id}`).emit('busETAUpdated', {
                busId: bus._id,
                busNumber: bus.number,
                eta,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (etaError) {
            // Individual ETA errors shouldn't stop the batch
            logger.debug(`ETA recalculation error for bus ${bus.number}: ${etaError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error('ETA recalculation job error:', error.message);
    }
  });

  // ── Daily Analytics Snapshot: Midnight ──────────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('Generating daily analytics snapshot...');
      const analyticsService = require('../services/analyticsService');
      
      const [overview, routePerformance, delayTrends] = await Promise.all([
        analyticsService.getFleetOverview(),
        analyticsService.getRoutePerformance(1),
        analyticsService.getDelayTrends(1),
      ]);

      logger.info('Daily analytics snapshot completed', {
        activeBuses: overview.activeBuses,
        totalRoutes: routePerformance.length,
        todayDelays: delayTrends[delayTrends.length - 1]?.delays || 0,
      });
    } catch (error) {
      logger.error('Daily analytics job error:', error.message);
    }
  });

  logger.info('All scheduled jobs started successfully');
}

module.exports = { startJobs };
