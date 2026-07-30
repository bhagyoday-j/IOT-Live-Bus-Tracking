const Bus = require('../models/Bus');
const Driver = require('../models/Driver');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getAllBuses = asyncHandler(async (req, res) => {
  const { status, depotId, page = 1, limit = 20 } = req.query;
  const query = {};
  
  if (status) query.status = status;
  if (depotId) query.depotId = depotId;

  const skip = (page - 1) * limit;
  
  const [buses, total] = await Promise.all([
    Bus.find(query)
      .populate('routeId', 'name number')
      .populate('driverId', 'name phone')
      .populate('depotId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Bus.countDocuments(query),
  ]);

  ApiResponse.paginated(res, buses, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
  });
});

exports.getBusById = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id)
    .populate('routeId')
    .populate('driverId')
    .populate('depotId', 'name code location')
    .lean();

  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  ApiResponse.success(res, { bus });
});

exports.createBus = asyncHandler(async (req, res) => {
  const bus = await Bus.create(req.body);
  
  if (bus.driverId) {
    await Driver.findByIdAndUpdate(bus.driverId, { currentBusId: bus._id, status: 'on-duty' });
  }

  ApiResponse.created(res, { bus }, 'Bus created successfully');
});

exports.updateBus = asyncHandler(async (req, res) => {
  const { driverId, ...updateData } = req.body;
  
  const bus = await Bus.findById(req.params.id);
  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  // Handle driver reassignment
  if (driverId && driverId !== bus.driverId?.toString()) {
    await Driver.findByIdAndUpdate(bus.driverId, { currentBusId: null, status: 'off-duty' });
    await Driver.findByIdAndUpdate(driverId, { currentBusId: bus._id, status: 'on-duty' });
    updateData.driverId = driverId;
  }

  const updated = await Bus.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).populate('routeId driverId depotId');

  ApiResponse.success(res, { bus: updated }, 'Bus updated successfully');
});

exports.deleteBus = asyncHandler(async (req, res) => {
  const bus = await Bus.findById(req.params.id);
  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  // Release driver
  if (bus.driverId) {
    await Driver.findByIdAndUpdate(bus.driverId, { currentBusId: null, status: 'off-duty' });
  }

  await Bus.findByIdAndUpdate(req.params.id, { isActive: false, status: 'maintenance' });

  ApiResponse.success(res, null, 'Bus deactivated successfully');
});

exports.updateBusLocation = asyncHandler(async (req, res) => {
  const { lat, lng, speed, heading } = req.body;
  
  const bus = await Bus.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        'currentLocation.lat': lat,
        'currentLocation.lng': lng,
        'currentLocation.speed': speed || 0,
        'currentLocation.heading': heading || 0,
        'currentLocation.updatedAt': new Date(),
      },
    },
    { new: true }
  );

  if (!bus) {
    return ApiResponse.notFound(res, 'Bus not found');
  }

  ApiResponse.success(res, { bus });
});

exports.getBusStats = asyncHandler(async (req, res) => {
  const stats = await Bus.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        avgSpeed: { $avg: '$currentLocation.speed' },
      },
    },
  ]);

  ApiResponse.success(res, { stats });
});
