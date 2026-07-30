const express = require('express');
const router = express.Router();
const routeController = require('../controllers/routeController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createRouteValidator, updateRouteValidator } = require('../validators/routeValidators');
const { auditLog } = require('../middleware/audit');

// Public routes
router.get('/search', routeController.searchRoutes);
router.get('/stats', routeController.getRouteStats);
router.get('/', routeController.getAllRoutes);
router.get('/:id', routeController.getRouteById);

// Protected routes
router.post('/', authenticate, authorize('admin', 'depot_manager'), createRouteValidator, validate, auditLog('create', 'route'), routeController.createRoute);
router.put('/:id', authenticate, authorize('admin', 'depot_manager'), updateRouteValidator, validate, auditLog('update', 'route'), routeController.updateRoute);
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete', 'route'), routeController.deleteRoute);

module.exports = router;
