const MaintenanceAlert = require('../models/MaintenanceAlert');
const predictiveMaintenanceService = require('../services/predictiveMaintenanceService');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

/**
 * GET /api/maintenance/alerts?status=open
 * Predictive maintenance alerts feed.
 */
exports.getAlerts = asyncHandler(async (req, res) => {
  const { status, busId, alertType, page = 1, limit = 20 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (busId) query.busId = busId;
  if (alertType) query.alertType = alertType;

  const skip = (page - 1) * limit;

  const [alerts, total, openCount] = await Promise.all([
    MaintenanceAlert.find(query)
      .sort({ detectedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('busId', 'number routeId')
      .lean(),
    MaintenanceAlert.countDocuments(query),
    MaintenanceAlert.countDocuments({ status: { $in: ['open', 'scheduled'] } }),
  ]);

  ApiResponse.paginated(res, alerts, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
    openCount,
  });
});

/**
 * GET /api/maintenance/alerts/:id
 */
exports.getAlertById = asyncHandler(async (req, res) => {
  const alert = await MaintenanceAlert.findById(req.params.id)
    .populate('busId', 'number routeId')
    .lean();

  if (!alert) {
    return ApiResponse.notFound(res, 'Maintenance alert not found');
  }

  ApiResponse.success(res, { alert });
});

/**
 * PUT /api/maintenance/alerts/:id/resolve
 */
exports.resolveAlert = asyncHandler(async (req, res) => {
  const alert = await MaintenanceAlert.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: req.userId,
        resolutionNotes: req.body.notes || 'Resolved',
      },
    },
    { new: true }
  );

  if (!alert) {
    return ApiResponse.notFound(res, 'Maintenance alert not found');
  }

  ApiResponse.success(res, { alert }, 'Maintenance alert resolved');
});

/**
 * POST /api/maintenance/analyze
 * Trigger a full predictive maintenance analysis pass now.
 */
exports.runAnalysis = asyncHandler(async (req, res) => {
  await predictiveMaintenanceService.analyzeAllBuses();
  ApiResponse.success(res, null, 'Predictive maintenance analysis completed');
});
