const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/alerts', authenticate, maintenanceController.getAlerts);
router.get('/alerts/:id', authenticate, maintenanceController.getAlertById);
router.put('/alerts/:id/resolve', authenticate, authorize('admin', 'depot_manager'), maintenanceController.resolveAlert);
router.post('/analyze', authenticate, authorize('admin', 'depot_manager'), maintenanceController.runAnalysis);

module.exports = router;
