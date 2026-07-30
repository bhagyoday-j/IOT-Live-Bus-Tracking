const express = require('express');
const router = express.Router();
const stopController = require('../controllers/stopController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { auditLog } = require('../middleware/audit');

// Public routes
router.get('/nearby', stopController.getNearbyStops);

// Protected routes
router.get('/', authenticate, stopController.getAllStops);
router.get('/:id', authenticate, stopController.getStopById);
router.post('/', authenticate, authorize('admin', 'depot_manager'), auditLog('create', 'stop'), stopController.createStop);
router.put('/:id', authenticate, authorize('admin', 'depot_manager'), auditLog('update', 'stop'), stopController.updateStop);
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete', 'stop'), stopController.deleteStop);

module.exports = router;
