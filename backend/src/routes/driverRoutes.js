const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createDriverValidator, updateDriverValidator } = require('../validators/driverValidators');
const { auditLog } = require('../middleware/audit');

router.get('/', authenticate, driverController.getAllDrivers);
router.get('/stats', authenticate, driverController.getDriverStats);
router.get('/:id', authenticate, driverController.getDriverById);
router.post('/', authenticate, authorize('admin', 'depot_manager'), createDriverValidator, validate, auditLog('create', 'driver'), driverController.createDriver);
router.put('/:id', authenticate, authorize('admin', 'depot_manager'), updateDriverValidator, validate, auditLog('update', 'driver'), driverController.updateDriver);
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete', 'driver'), driverController.deleteDriver);

module.exports = router;
