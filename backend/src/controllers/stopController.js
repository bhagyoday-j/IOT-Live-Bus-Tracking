const Stop = require('../models/Stop');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

/**
 * @desc    Get all stops with optional filtering
 * @route   GET /api/stops
 */
exports.getAllStops = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.query;
  const query = {};

  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { code: { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;

  const [stops, total] = await Promise.all([
    Stop.find(query)
      .populate('routes', 'name number')
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Stop.countDocuments(query),
  ]);

  ApiResponse.paginated(res, stops, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
  });
});

/**
 * @desc    Get single stop by ID
 * @route   GET /api/stops/:id
 */
exports.getStopById = asyncHandler(async (req, res) => {
  const stop = await Stop.findById(req.params.id)
    .populate('routes', 'name number source destination')
    .lean();

  if (!stop) {
    return ApiResponse.notFound(res, 'Stop not found');
  }

  ApiResponse.success(res, { stop });
});

/**
 * @desc    Create a new stop
 * @route   POST /api/stops
 */
exports.createStop = asyncHandler(async (req, res) => {
  const stop = await Stop.create(req.body);
  ApiResponse.created(res, { stop }, 'Stop created successfully');
});

/**
 * @desc    Update a stop
 * @route   PUT /api/stops/:id
 */
exports.updateStop = asyncHandler(async (req, res) => {
  const stop = await Stop.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('routes', 'name number');

  if (!stop) {
    return ApiResponse.notFound(res, 'Stop not found');
  }

  ApiResponse.success(res, { stop }, 'Stop updated successfully');
});

/**
 * @desc    Delete/deactivate a stop
 * @route   DELETE /api/stops/:id
 */
exports.deleteStop = asyncHandler(async (req, res) => {
  const stop = await Stop.findByIdAndUpdate(
    req.params.id,
    { isActive: false, status: 'inactive' },
    { new: true }
  );

  if (!stop) {
    return ApiResponse.notFound(res, 'Stop not found');
  }

  ApiResponse.success(res, null, 'Stop deactivated successfully');
});

/**
 * @desc    Get stops near a location (geospatial)
 * @route   GET /api/stops/nearby
 */
exports.getNearbyStops = asyncHandler(async (req, res) => {
  const { lat, lng, radius = 1000 } = req.query;

  if (!lat || !lng) {
    return ApiResponse.badRequest(res, 'Latitude and longitude are required');
  }

  const stops = await Stop.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: parseInt(radius),
      },
    },
    isActive: true,
    status: 'active',
  }).populate('routes', 'name number').limit(20).lean();

  ApiResponse.success(res, { stops, count: stops.length });
});
