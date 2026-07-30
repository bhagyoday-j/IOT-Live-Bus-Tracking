const Bus = require('../models/Bus');
const BusLocation = require('../models/BusLocation');
const SOSAlert = require('../models/SOSAlert');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const delayDetectionService = require('../services/delayDetectionService');
const etaService = require('../services/etaService');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

exports.submitGpsData = asyncHandler(async (req, res) => {
  const { deviceId, lat, lng, speed, heading, timestamp, sos } = req.body;

  // Find bus by device ID
  const bus = req.bus || await Bus.findOne({ deviceId });
  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found for this device');
  }

  // Update current location
  bus.currentLocation = {
    lat,
    lng,
    speed: speed || 0,
    heading: heading || 0,
    updatedAt: new Date(timestamp || Date.now()),
  };

  if (sos !== undefined) bus.sosActive = sos;
  await bus.save();

  // Store location history
  const locationRecord = await BusLocation.create({
    busId: bus._id,
    deviceId,
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    speed: speed || 0,
    heading: heading || 0,
    sos: sos || false,
    timestamp: new Date(timestamp || Date.now()),
  });

  // Cache latest location
  await redisService.cacheBusLocation(bus._id.toString(), {
    busId: bus._id,
    deviceId,
    lat,
    lng,
    speed,
    heading,
    timestamp: locationRecord.timestamp,
  });

  // Handle SOS
  if (sos) {
    await SOSAlert.create({
      busId: bus._id,
      deviceId,
      location: { type: 'Point', coordinates: [lng, lat] },
      speed,
      heading,
      timestamp: new Date(),
      severity: 'high',
    });

    logger.warn(`SOS triggered for bus ${bus.number} (${deviceId}) at [${lat}, ${lng}]`);
  }

  // Check for delays if bus is on route
  if (bus.routeId && (bus.status === 'on-route' || bus.status === 'delayed')) {
    const route = await bus.populate('routeId');
    delayDetectionService.checkBusDelay(bus, route.routeId, { lat, lng, speed }).catch(err => {
      logger.error('Delay check error:', err.message);
    });
  }

  ApiResponse.success(res, {
    locationId: locationRecord._id,
    busId: bus._id,
    status: bus.status,
    sos: sos || false,
  }, 'GPS data received');
});

exports.getBusLocation = asyncHandler(async (req, res) => {
  const busId = req.params.id;

  // Try cache first
  const cached = await redisService.getBusLocation(busId);
  if (cached) {
    return ApiResponse.success(res, { location: cached, source: 'cache' });
  }

  // Get from database
  const location = await BusLocation.getLatestLocation(busId);
  if (!location) {
    return ApiResponse.notFound(res, 'No location data found for this bus');
  }

  ApiResponse.success(res, { location, source: 'database' });
});

exports.getBusLocationHistory = asyncHandler(async (req, res) => {
  const { id: busId } = req.params;
  const { minutes = 30 } = req.query;

  const history = await BusLocation.getLocationHistory(busId, parseInt(minutes));

  ApiResponse.success(res, {
    history,
    count: history.length,
    busId,
    timeframe: `${minutes} minutes`,
  });
});

exports.getAllActiveLocations = asyncHandler(async (req, res) => {
  const buses = await Bus.find({
    status: { $in: ['on-route', 'delayed'] },
    'currentLocation.lat': { $exists: true },
  })
    .select('number status currentLocation routeId delay')
    .populate('routeId', 'name number')
    .lean();

  const locations = buses.map(bus => ({
    busId: bus._id,
    busNumber: bus.number,
    routeName: bus.routeId?.name || 'Not assigned',
    routeNumber: bus.routeId?.number || 'N/A',
    status: bus.status,
    delay: bus.delay || 0,
    lat: bus.currentLocation?.lat,
    lng: bus.currentLocation?.lng,
    speed: bus.currentLocation?.speed || 0,
    heading: bus.currentLocation?.heading || 0,
    updatedAt: bus.currentLocation?.updatedAt,
  }));

  ApiResponse.success(res, { locations, count: locations.length });
});

exports.getETA = asyncHandler(async (req, res) => {
  const { id: busId } = req.params;

  const bus = await Bus.findById(busId).populate('routeId');
  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  if (!bus.routeId) {
    return ApiResponse.success(res, { eta: null, message: 'Bus is not assigned to any route' });
  }

  const eta = await etaService.calculateETA(
    bus,
    bus.routeId,
    bus.currentLocation
  );

  ApiResponse.success(res, { eta });
});
