const Route = require('../models/Route');
const Bus = require('../models/Bus');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getAllRoutes = asyncHandler(async (req, res) => {
  const { status, source, destination, page = 1, limit = 20 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (source) query.source = { $regex: source, $options: 'i' };
  if (destination) query.destination = { $regex: destination, $options: 'i' };

  const skip = (page - 1) * limit;

  const [routes, total] = await Promise.all([
    Route.find(query)
      .populate('assignedBuses', 'number status currentLocation')
      .populate('stops.stopId', 'name location code')
      .populate('depotId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Route.countDocuments(query),
  ]);

  ApiResponse.paginated(res, routes, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
  });
});

exports.getRouteById = asyncHandler(async (req, res) => {
  const route = await Route.findById(req.params.id)
    .populate('assignedBuses', 'number status currentLocation driverId')
    .populate('stops.stopId', 'name location code amenities')
    .populate('depotId', 'name code location')
    .lean();

  if (!route) {
    return ApiResponse.notFound(res, 'Route not found');
  }

  ApiResponse.success(res, { route });
});

exports.createRoute = asyncHandler(async (req, res) => {
  const route = await Route.create(req.body);

  ApiResponse.created(res, { route }, 'Route created successfully');
});

exports.updateRoute = asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('assignedBuses stops.stopId');

  if (!route) {
    return ApiResponse.notFound(res, 'Route not found');
  }

  ApiResponse.success(res, { route }, 'Route updated successfully');
});

exports.deleteRoute = asyncHandler(async (req, res) => {
  const route = await Route.findByIdAndUpdate(
    req.params.id,
    { isActive: false, status: 'cancelled' },
    { new: true }
  );

  if (!route) {
    return ApiResponse.notFound(res, 'Route not found');
  }

  // Unassign buses from this route
  await Bus.updateMany(
    { routeId: req.params.id },
    { routeId: null, status: 'idle' }
  );

  ApiResponse.success(res, null, 'Route deactivated successfully');
});

exports.searchRoutes = asyncHandler(async (req, res) => {
  const { source, destination } = req.query;

  if (!source || !destination) {
    return ApiResponse.badRequest(res, 'Source and destination are required');
  }

  const routes = await Route.find({
    source: { $regex: source, $options: 'i' },
    destination: { $regex: destination, $options: 'i' },
    status: 'active',
    isActive: true,
  })
    .populate('assignedBuses', 'number status currentLocation')
    .limit(10)
    .lean();

  ApiResponse.success(res, { routes, count: routes.length });
});

exports.getRouteStats = asyncHandler(async (req, res) => {
  const stats = await Route.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalDistance: { $sum: '$totalDistance' },
        avgDuration: { $avg: '$totalDuration' },
        avgFare: { $avg: '$baseFare' },
      },
    },
  ]);

  ApiResponse.success(res, { stats });
});

/**
 * @desc    Plan a route between source and destination
 * @route   POST /api/routes/plan
 * 
 * Request: { "source": "Kopargaon", "destination": "Shirdi" }
 * Response: {
 *   "estimatedTime": "35 min",
 *   "totalFare": 35,
 *   "interchanges": 0,
 *   "buses": []
 * }
 */
exports.planRoute = asyncHandler(async (req, res) => {
  const { source, destination } = req.body;

  if (!source || !destination) {
    return ApiResponse.badRequest(res, 'Source and destination are required');
  }

  // Find direct routes matching source and destination
  const directRoutes = await Route.find({
    source: { $regex: `^${source}$`, $options: 'i' },
    destination: { $regex: `^${destination}$`, $options: 'i' },
    status: 'active',
    isActive: true,
  })
    .populate({
      path: 'assignedBuses',
      match: { status: { $in: ['on-route', 'delayed'] }, isActive: true },
      select: 'number status currentLocation delay deviceId',
    })
    .lean();

  // Also try fuzzy matching for route names
  let routes = directRoutes;
  if (routes.length === 0) {
    routes = await Route.find({
      $or: [
        { source: { $regex: source, $options: 'i' }, destination: { $regex: destination, $options: 'i' } },
        { name: { $regex: `${source}.*${destination}|${destination}.*${source}`, $options: 'i' } },
      ],
      status: 'active',
      isActive: true,
    })
      .populate({
        path: 'assignedBuses',
        match: { status: { $in: ['on-route', 'delayed'] }, isActive: true },
        select: 'number status currentLocation delay deviceId',
      })
      .limit(5)
      .lean();
  }

  if (routes.length === 0) {
    // Try finding routes with interchanges (source->intermediate, intermediate->destination)
    const sourceRoutes = await Route.find({
      source: { $regex: source, $options: 'i' },
      status: 'active',
      isActive: true,
    }).select('destination name number baseFare totalDuration assignedBuses').lean();

    const interchangeOptions = [];
    
    for (const srcRoute of sourceRoutes) {
      const connectingRoutes = await Route.find({
        source: { $regex: `^${srcRoute.destination}$`, $options: 'i' },
        destination: { $regex: destination, $options: 'i' },
        status: 'active',
        isActive: true,
      })
        .populate({
          path: 'assignedBuses',
          match: { status: { $in: ['on-route', 'delayed'] }, isActive: true },
          select: 'number status currentLocation',
        })
        .lean();

      for (const connRoute of connectingRoutes) {
        interchangeOptions.push({
          route1: {
            name: srcRoute.name,
            number: srcRoute.number,
            from: source,
            to: srcRoute.destination,
            fare: srcRoute.baseFare,
            duration: srcRoute.totalDuration,
          },
          route2: {
            name: connRoute.name,
            number: connRoute.number,
            from: connRoute.source,
            to: destination,
            fare: connRoute.baseFare,
            duration: connRoute.totalDuration,
          },
          interchangeAt: srcRoute.destination,
          totalFare: srcRoute.baseFare + connRoute.baseFare,
          totalDuration: srcRoute.totalDuration + connRoute.totalDuration,
        });
      }
    }

    if (interchangeOptions.length > 0) {
      const best = interchangeOptions.reduce((min, opt) => 
        opt.totalDuration < min.totalDuration ? opt : min
      );

      return ApiResponse.success(res, {
        estimatedTime: `${best.totalDuration} min`,
        totalFare: best.totalFare,
        interchanges: 1,
        interchangeAt: best.interchangeAt,
        buses: [
          {
            route: best.route1.name,
            from: best.route1.from,
            to: best.route1.to,
            fare: best.route1.fare,
          },
          {
            route: best.route2.name,
            from: best.route2.from,
            to: best.route2.to,
            fare: best.route2.fare,
          },
        ],
        options: interchangeOptions.slice(0, 3),
      });
    }

    return ApiResponse.success(res, {
      estimatedTime: 'N/A',
      totalFare: 0,
      interchanges: 0,
      buses: [],
      message: 'No direct route found between the specified locations',
    });
  }

  // Process the best route
  const route = routes[0];
  const activeBuses = (route.assignedBuses || []).filter(b => b);

  return ApiResponse.success(res, {
    estimatedTime: `${route.totalDuration} min`,
    totalFare: route.baseFare,
    interchanges: 0,
    routeName: route.name,
    routeNumber: route.number,
    source: route.source,
    destination: route.destination,
    distance: route.totalDistance,
    farePerKm: route.farePerKm,
    buses: activeBuses.map(b => ({
      busId: b._id,
      busNumber: b.number,
      status: b.status,
      delay: b.delay || 0,
      location: b.currentLocation,
    })),
  });
});
