const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/dashboard', authenticate, analyticsController.getDashboardOverview);
router.get('/fleet-overview', authenticate, analyticsController.getFleetOverview);
router.get('/route-performance', authenticate, analyticsController.getRoutePerformance);
router.get('/delay-trends', authenticate, analyticsController.getDelayTrends);
router.get('/trip-distribution', authenticate, analyticsController.getTripDistribution);
router.get('/bus-utilization', authenticate, authorize('admin', 'depot_manager'), analyticsController.getBusUtilization);
router.get('/heatmap', authenticate, analyticsController.getHeatmapData);

module.exports = router;
