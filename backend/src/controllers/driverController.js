const Driver = require('../models/Driver');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getAllDrivers = asyncHandler(async (req, res) => {
  const { status, depotId, page = 1, limit = 20 } = req.query;
  const query = {};
  
  if (status) query.status = status;
  if (depotId) query.assignedDepotId = depotId;

  const skip = (page - 1) * limit;

  const [drivers, total] = await Promise.all([
    Driver.find(query)
      .populate('currentBusId', 'number status')
      .populate('assignedDepotId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Driver.countDocuments(query),
  ]);

  ApiResponse.paginated(res, drivers, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
  });
});

exports.getDriverById = asyncHandler(async (req, res) => {
  const driver = await Driver.findById(req.params.id)
    .populate('currentBusId', 'number status currentLocation')
    .populate('assignedDepotId', 'name code location')
    .lean();

  if (!driver) {
    return ApiResponse.notFound(res, 'Driver not found');
  }

  ApiResponse.success(res, { driver });
});

exports.createDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.create(req.body);
  ApiResponse.created(res, { driver }, 'Driver created successfully');
});

exports.updateDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).populate('currentBusId assignedDepotId');

  if (!driver) {
    return ApiResponse.notFound(res, 'Driver not found');
  }

  ApiResponse.success(res, { driver }, 'Driver updated successfully');
});

exports.deleteDriver = asyncHandler(async (req, res) => {
  const driver = await Driver.findByIdAndUpdate(
    req.params.id,
    { isActive: false, status: 'inactive' },
    { new: true }
  );

  if (!driver) {
    return ApiResponse.notFound(res, 'Driver not found');
  }

  ApiResponse.success(res, null, 'Driver deactivated successfully');
});

exports.getDriverStats = asyncHandler(async (req, res) => {
  const stats = await Driver.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgExperience: { $avg: '$experience' },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  ApiResponse.success(res, { stats });
});
