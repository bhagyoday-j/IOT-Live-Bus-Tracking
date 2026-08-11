const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./authRoutes');
const busRoutes = require('./busRoutes');
const routeRoutes = require('./routeRoutes');
const driverRoutes = require('./driverRoutes');
const depotRoutes = require('./depotRoutes');
const gpsRoutes = require('./gpsRoutes');
const notificationRoutes = require('./notificationRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const stopRoutes = require('./stopRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const telemetryRoutes = require('./telemetryRoutes');
const safetyRoutes = require('./safetyRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SmartTransit AI API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/buses', busRoutes);
router.use('/routes', routeRoutes);
router.use('/drivers', driverRoutes);
router.use('/depots', depotRoutes);
router.use('/stops', stopRoutes);
router.use('/gps', gpsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/health', telemetryRoutes);
router.use('/safety', safetyRoutes);
router.use('/maintenance', maintenanceRoutes);

// Live tracking alias used by the frontend (busService.getLiveTracking)
router.get('/tracking/live', require('../middleware/auth').authenticate, require('../controllers/gpsController').getAllActiveLocations);

// 404 handler for unknown API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
