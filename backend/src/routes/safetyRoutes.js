const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safetyController');
const { authenticate } = require('../middleware/auth');
const { authorizeDepotAccess } = require('../middleware/rbac');

router.get('/drivers', authenticate, authorizeDepotAccess(), safetyController.getDrivers);
router.get('/driver/:id', authenticate, safetyController.getDriverById);
router.get('/events', authenticate, safetyController.getEvents);
router.get('/bus/:id/events', authenticate, safetyController.getBusEvents);

module.exports = router;
