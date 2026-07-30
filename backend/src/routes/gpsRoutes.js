const express = require('express');
const router = express.Router();
const gpsController = require('../controllers/gpsController');
const { authenticate, authenticateDevice } = require('../middleware/auth');
const { gpsDataLimiter } = require('../middleware/rateLimiter');

// Device GPS submission endpoint (authenticated via device credentials)
router.post('/data', gpsDataLimiter, authenticateDevice, gpsController.submitGpsData);

// Real-time tracking endpoints (user authenticated)
router.get('/active', authenticate, gpsController.getAllActiveLocations);
router.get('/bus/:id', authenticate, gpsController.getBusLocation);
router.get('/bus/:id/history', authenticate, gpsController.getBusLocationHistory);
router.get('/bus/:id/eta', authenticate, gpsController.getETA);

module.exports = router;
