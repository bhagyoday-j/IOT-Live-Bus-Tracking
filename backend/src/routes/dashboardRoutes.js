const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');
const { authorize, authorizeDepotAccess } = require('../middleware/rbac');

// Manager dashboard (accessible by depot_manager and admin)
// Uses authorizeDepotAccess to restrict depot_manager to their own depot data
router.get('/manager', authenticate, authorizeDepotAccess(), dashboardController.getManagerDashboard);

// Admin dashboard (admin only)
router.get('/admin', authenticate, authorize('admin'), dashboardController.getAdminDashboard);

// Real-time monitoring dashboard (accessible by all roles)
router.get('/realtime', authenticate, dashboardController.getRealtimeDashboard);

module.exports = router;
