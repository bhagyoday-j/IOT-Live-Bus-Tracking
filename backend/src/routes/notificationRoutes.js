const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { auditLog } = require('../middleware/audit');

router.get('/', authenticate, notificationController.getNotifications);
router.put('/:id/read', authenticate, notificationController.markAsRead);
router.put('/read-all', authenticate, notificationController.markAllAsRead);

// Admin only
router.post('/', authenticate, authorize('admin', 'depot_manager'), auditLog('create', 'notification'), notificationController.createNotification);
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete', 'notification'), notificationController.deleteNotification);

module.exports = router;
