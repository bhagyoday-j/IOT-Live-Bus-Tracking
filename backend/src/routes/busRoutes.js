const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { gpsDataLimiter } = require('../middleware/rateLimiter');
const { createBusValidator, updateBusValidator, busIdValidator } = require('../validators/busValidators');
const { auditLog } = require('../middleware/audit');

// Public routes
router.get('/locations', busController.getAllBuses);
router.get('/stats', busController.getBusStats);

// Protected routes
router.get('/', authenticate, busController.getAllBuses);
router.get('/:id', authenticate, busController.getBusById);
router.post('/', authenticate, authorize('admin', 'depot_manager'), createBusValidator, validate, auditLog('create', 'bus'), busController.createBus);
router.put('/:id', authenticate, authorize('admin', 'depot_manager'), updateBusValidator, validate, auditLog('update', 'bus'), busController.updateBus);
router.delete('/:id', authenticate, authorize('admin'), busIdValidator, validate, auditLog('delete', 'bus'), busController.deleteBus);
router.put('/:id/location', authenticate, busController.updateBusLocation);

// Device GPS endpoint (rate limited)
router.post('/gps', gpsDataLimiter, busController.updateBusLocation);

module.exports = router;
