const Driver = require('../models/Driver');
const DriverEvent = require('../models/DriverEvent');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

/**
 * GET /api/safety/drivers
 * Driver safety report – score, event breakdown and trend for every driver.
 */
exports.getDrivers = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;

  const drivers = await Driver.find({
    ...(depotId ? { assignedDepotId: depotId } : {}),
    isActive: true,
  })
    .select('name phone status currentBusId safety totalTrips rating')
    .lean();

  const list = drivers.map((d) => ({
    driverId: d._id,
    name: d.name,
    status: d.status,
    currentBusId: d.currentBusId,
    safety: d.safety || { score: 100, totalEvents: 0, harshBraking: 0, suddenAcceleration: 0, sharpTurns: 0, excessiveVibration: 0, trend: 'stable' },
    totalTrips: d.totalTrips || 0,
    rating: d.rating,
  }));

  const scored = list.filter((d) => d.safety.totalEvents > 0 || d.safety.score < 100);
  const fleetAverage = scored.length > 0
    ? Math.round((scored.reduce((s, d) => s + d.safety.score, 0) / scored.length) * 10) / 10
    : 100;

  ApiResponse.success(res, { drivers: list, fleetAverage });
});

/**
 * GET /api/safety/driver/:id
 * Single driver safety report.
 */
exports.getDriverById = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id)
    .select('name phone status currentBusId safety totalTrips rating')
    .lean();

  if (!driver) {
    return ApiResponse.notFound(res, 'Driver not found');
  }

  const recentEvents = await DriverEvent.find({ driverId: driver._id })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

  ApiResponse.success(res, {
    driver: {
      driverId: driver._id,
      name: driver.name,
      status: driver.status,
      safety: driver.safety || { score: 100 },
    },
    recentEvents,
  });
});

/**
 * GET /api/safety/events?busId=&driverId=&type=&limit=50
 * Recent driver safety events feed.
 */
exports.getEvents = asyncHandler(async (req, res) => {
  const { busId, driverId, type, limit = 50 } = req.query;
  const query = {};

  if (busId) query.busId = busId;
  if (driverId) query.driverId = driverId;
  if (type) query.type = type;

  const events = await DriverEvent.find(query)
    .sort({ timestamp: -1 })
    .limit(parseInt(limit))
    .populate('busId', 'number')
    .populate('driverId', 'name')
    .lean();

  const list = events.map((e) => ({
    eventId: e._id,
    busId: e.busId?._id || e.busId,
    busNumber: e.busId?.number || null,
    driverId: e.driverId?._id || e.driverId,
    driverName: e.driverId?.name || null,
    type: e.type,
    severity: e.severity,
    magnitude: e.magnitude,
    speed: e.speed,
    isAccident: e.isAccident,
    location: e.location,
    timestamp: e.timestamp,
  }));

  ApiResponse.success(res, { events: list, count: list.length });
});

/**
 * GET /api/safety/bus/:id/events
 * Safety events for a specific bus.
 */
exports.getBusEvents = asyncHandler(async (req, res) => {
  const events = await DriverEvent.find({ busId: req.params.id })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('driverId', 'name')
    .lean();

  const list = events.map((e) => ({
    eventId: e._id,
    driverName: e.driverId?.name || null,
    type: e.type,
    severity: e.severity,
    magnitude: e.magnitude,
    speed: e.speed,
    isAccident: e.isAccident,
    location: e.location,
    timestamp: e.timestamp,
  }));

  ApiResponse.success(res, { events: list, count: list.length });
});
