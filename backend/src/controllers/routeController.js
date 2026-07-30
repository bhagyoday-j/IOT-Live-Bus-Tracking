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
