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
router.use('/gps', gpsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);

// 404 handler for unknown API routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
