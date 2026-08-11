const Bus = require('../models/Bus');
const Telemetry = require('../models/Telemetry');
const DriverEvent = require('../models/DriverEvent');
const MaintenanceAlert = require('../models/MaintenanceAlert');
const telemetryService = require('../services/telemetryService');
const accidentDetectionService = require('../services/accidentDetectionService');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * POST /api/health/data  (device authenticated)
 * Ingest a telemetry reading over HTTP (same pipeline as MQTT).
 */
exports.submitTelemetry = asyncHandler(async (req, res) => {
  const deviceId = req.deviceId || req.body.deviceId;
  const result = await telemetryService.processTelemetry(deviceId, req.body);

  if (!result.success) {
    return ApiResponse.badRequest(res, 'Invalid telemetry payload', result.errors);
  }

  ApiResponse.success(res, {
    telemetryId: result.telemetry._id,
    busId: result.telemetry.busId,
    healthStatus: result.health.status,
    safetyEvents: result.safetyEvents,
    accidentAlertId: result.accident,
  }, 'Telemetry received');
});

/**
 * GET /api/health/buses
 * Fleet health overview – every bus with its live health snapshot.
 */
exports.getFleetHealth = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;

  const buses = await Bus.find({
    ...(depotId ? { depotId } : {}),
    isActive: true,
  })
    .select('number status health routeId driverId currentLocation')
    .populate('routeId', 'name number')
    .populate('driverId', 'name')
    .lean();

  const summary = { healthy: 0, warning: 0, critical: 0, unknown: 0 };

  const list = buses.map((bus) => {
    const status = bus.health?.status || 'unknown';
    summary[status] = (summary[status] || 0) + 1;

    return {
      busId: bus._id,
      busNumber: bus.number,
      route: bus.routeId?.name || 'Not assigned',
      busStatus: bus.status,
      healthStatus: status,
      engineTemperature: bus.health?.engineTemperature ?? null,
      batteryVoltage: bus.health?.batteryVoltage ?? null,
      currentDraw: bus.health?.currentDraw ?? null,
      vibration: bus.health?.vibration ?? 0,
      lastEvent: bus.health?.lastEvent || null,
      lastReadingAt: bus.health?.updatedAt || null,
      driver: bus.driverId?.name || null,
      location: bus.currentLocation ? {
        lat: bus.currentLocation.lat,
        lng: bus.currentLocation.lng,
      } : null,
    };
  });

  ApiResponse.success(res, { buses: list, summary, monitored: buses.length });
});

/**
 * GET /api/health/bus/:id
 * Deep dive for a single bus: health snapshot, latest telemetry, recent
 * safety events and open maintenance alerts.
 */
exports.getBusHealth = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id)
    .populate('routeId', 'name number')
    .populate('driverId', 'name phone')
    .lean();

  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  const [latestTelemetry, recentEvents, openAlerts] = await Promise.all([
    Telemetry.findOne({ busId: bus._id }).sort({ timestamp: -1 }).lean(),
    DriverEvent.find({ busId: bus._id }).sort({ timestamp: -1 }).limit(10).lean(),
    MaintenanceAlert.find({ busId: bus._id, status: { $in: ['open', 'scheduled'] } })
      .sort({ detectedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  ApiResponse.success(res, {
    bus: {
      id: bus._id,
      busNumber: bus.number,
      status: bus.status,
      route: bus.routeId?.name || 'Not assigned',
      driver: bus.driverId?.name || null,
      deviceId: bus.deviceId,
    },
    health: bus.health,
    latestTelemetry,
    recentEvents,
    openAlerts,
  });
});

/**
 * GET /api/health/bus/:id/telemetry?minutes=60
 * Raw telemetry history for charting.
 */
exports.getTelemetryHistory = asyncHandler(async (req, res) => {
  const { id: busId } = req.params;
  const { minutes = 60 } = req.query;

  const since = new Date(Date.now() - parseInt(minutes) * 60 * 1000);
  const telemetry = await Telemetry.find({
    busId,
    timestamp: { $gte: since },
  })
    .sort({ timestamp: 1 })
    .select('engineTemperature batteryVoltage currentDraw vibration speed timestamp')
    .lean();

  ApiResponse.success(res, {
    busId,
    telemetry,
    count: telemetry.length,
    timeframe: `${minutes} minutes`,
  });
});

/**
 * POST /api/health/simulate/accident/:busId
 * Demo helper: inject a synthetic high-impact reading to exercise the
 * automatic accident detection pipeline end to end.
 */
exports.simulateAccident = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }
  if (!bus.deviceId) {
    return ApiResponse.badRequest(res, 'Bus has no registered device ID');
  }

  const location = bus.currentLocation || { lat: 19.076, lng: 72.8777 };
  const reading = {
    engineTemperature: bus.health?.engineTemperature ?? 92,
    batteryVoltage: bus.health?.batteryVoltage ?? 13.6,
    currentDraw: bus.health?.currentDraw ?? 22,
    accelerometer: { x: -4.2, y: 2.8, z: 33.6 }, // ~34 m/s² resultant -> impact
    gyroscope: { x: 0.4, y: 0.2, z: 12.5 },
    vibration: 6.8,
    speed: location.speed ?? 45,
    lat: location.lat,
    lng: location.lng,
  };

  const alert = await accidentDetectionService.detect(bus, reading);
  if (!alert) {
    return ApiResponse.success(res, { simulated: true, alert: null }, 'No new accident alert raised (recent alert exists)');
  }

  logger.warn(`[SIM] Simulated accident for bus ${bus.number}`);

  ApiResponse.created(res, {
    simulated: true,
    alert,
    busNumber: bus.number,
    location,
  }, 'Simulated accident alert created');
});
