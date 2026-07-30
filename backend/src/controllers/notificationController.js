const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');

exports.getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type, isRead } = req.query;
  const query = {};

  // Filter by user or all if admin
  if (req.userRole === 'admin') {
    // Admins see all
  } else if (req.userRole === 'depot_manager') {
    query.audience = { $in: ['all', 'depot_managers'] };
    if (req.user.depotId) {
      query.$or = [
        { depotId: req.user.depotId },
        { audience: { $in: ['all', 'depot_managers'] } },
      ];
    }
  } else {
    query.$or = [
      { userId: req.userId },
      { audience: { $in: ['all', 'passengers'] } },
      { targetUsers: req.userId },
    ];
  }

  if (type) query.type = type;
  if (isRead !== undefined) query.isRead = isRead === 'true';

  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  ApiResponse.paginated(res, notifications, {
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    pages: Math.ceil(total / limit),
    unreadCount,
  });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(
    req.params.id,
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    return ApiResponse.notFound(res, 'Notification not found');
  }

  ApiResponse.success(res, { notification }, 'Marked as read');
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  const query = { isRead: false };
  
  if (req.userRole !== 'admin') {
    query.$or = [
      { userId: req.userId },
      { audience: { $in: ['all', 'passengers'] } },
    ];
  }

  const result = await Notification.updateMany(
    query,
    { isRead: true, readAt: new Date() }
  );

  ApiResponse.success(res, {
    modifiedCount: result.modifiedCount,
  }, 'All notifications marked as read');
});

exports.createNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.create(req.body);

  ApiResponse.created(res, { notification }, 'Notification created');
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndDelete(req.params.id);

  if (!notification) {
    return ApiResponse.notFound(res, 'Notification not found');
  }

  ApiResponse.success(res, null, 'Notification deleted');
});
