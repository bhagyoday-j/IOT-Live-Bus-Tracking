const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { authenticate, authenticateDevice } = require('../middleware/auth');
const { authorize, authorizeDepotAccess } = require('../middleware/rbac');

// Device telemetry ingestion (HTTP alternative to MQTT bus/telemetry/{deviceId})
router.post('/data', authenticateDevice, telemetryController.submitTelemetry);

// Fleet health (authenticated users)
router.get('/buses', authenticate, authorizeDepotAccess(), telemetryController.getFleetHealth);
router.get('/bus/:id', authenticate, telemetryController.getBusHealth);
router.get('/bus/:id/telemetry', authenticate, telemetryController.getTelemetryHistory);

// Demo helper – simulate an accident for a bus (managers/admins)
router.post(
  '/simulate/accident/:id',
  authenticate,
  authorize('admin', 'depot_manager'),
  telemetryController.simulateAccident
);

module.exports = router;
