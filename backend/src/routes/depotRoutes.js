const express = require('express');
const router = express.Router();
const depotController = require('../controllers/depotController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { validate } = require('../middleware/validate');
const { createDepotValidator, updateDepotValidator } = require('../validators/depotValidators');
const { auditLog } = require('../middleware/audit');

router.get('/', authenticate, depotController.getAllDepots);
router.get('/stats', authenticate, depotController.getDepotStats);
router.get('/:id', authenticate, depotController.getDepotById);
router.post('/', authenticate, authorize('admin'), createDepotValidator, validate, auditLog('create', 'depot'), depotController.createDepot);
router.put('/:id', authenticate, authorize('admin', 'depot_manager'), updateDepotValidator, validate, auditLog('update', 'depot'), depotController.updateDepot);
router.delete('/:id', authenticate, authorize('admin'), auditLog('delete', 'depot'), depotController.deleteDepot);

module.exports = router;
