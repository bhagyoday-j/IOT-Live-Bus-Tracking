const Depot = require('../models/Depot');
const Bus = require('../models/Bus');
const Driver = require('../models/Driver');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getAllDepots = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;

  const [depots, total] = await Promise.all([
    Depot.find(query)
      .populate('managers', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Depot.countDocuments(query),
  ]);

  ApiResponse.paginated(res, depots, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
  });
});

exports.getDepotById = asyncHandler(async (req, res) => {
  const depot = await Depot.findById(req.params.id)
    .populate('managers', 'name email phone')
    .populate('assignedRoutes', 'name number status')
    .lean();

  if (!depot) {
    return ApiResponse.notFound(res, 'Depot not found');
  }

  // Get current fleet stats
  const [buses, drivers] = await Promise.all([
    Bus.find({ depotId: depot._id }).lean(),
    Driver.find({ assignedDepotId: depot._id }).lean(),
  ]);

  depot.fleet = {
    buses: buses.length,
    activeBuses: buses.filter(b => b.status === 'on-route').length,
    drivers: drivers.length,
    activeDrivers: drivers.filter(d => d.status === 'active' || d.status === 'on-duty').length,
  };

  ApiResponse.success(res, { depot });
});

exports.createDepot = asyncHandler(async (req, res) => {
  const depot = await Depot.create(req.body);
  ApiResponse.created(res, { depot }, 'Depot created successfully');
});

exports.updateDepot = asyncHandler(async (req, res) => {
  const depot = await Depot.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('managers', 'name email');

  if (!depot) {
    return ApiResponse.notFound(res, 'Depot not found');
  }

  ApiResponse.success(res, { depot }, 'Depot updated successfully');
});

exports.deleteDepot = asyncHandler(async (req, res) => {
  const depot = await Depot.findByIdAndUpdate(
    req.params.id,
    { isActive: false, status: 'inactive' },
    { new: true }
  );

  if (!depot) {
    return ApiResponse.notFound(res, 'Depot not found');
  }

  ApiResponse.success(res, null, 'Depot deactivated successfully');
});

exports.getDepotStats = asyncHandler(async (req, res) => {
  const stats = await Depot.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalCapacity: { $sum: '$capacity.total' },
        totalBuses: { $sum: '$stats.totalBuses' },
      },
    },
  ]);

  ApiResponse.success(res, { stats });
});
