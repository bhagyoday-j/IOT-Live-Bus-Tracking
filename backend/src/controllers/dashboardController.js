const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Driver = require('../models/Driver');
const Depot = require('../models/Depot');
const User = require('../models/User');
const Trip = require('../models/Trip');
const Notification = require('../models/Notification');
const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { getOnlineUsersCount } = require('../sockets/index');

/**
 * @desc    Manager Dashboard - Real-time operational overview
 * @route   GET /api/dashboard/manager
 * 
 * Response:
 * {
 *   activeBuses: 120,
 *   delayedBuses: 8,
 *   cancelledBuses: 2,
 *   activeRoutes: 35
 * }
 */
exports.getManagerDashboard = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;
  const matchQuery = depotId ? { depotId } : {};

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get real-time fleet stats
  const activeBuses = await Bus.countDocuments({
    ...matchQuery,
    status: 'on-route',
    isActive: true,
  });

  const delayedBuses = await Bus.countDocuments({
    ...matchQuery,
    status: 'delayed',
    isActive: true,
  });

  const cancelledBuses = await Bus.countDocuments({
    ...matchQuery,
    status: 'cancelled',
  });

  const idleBuses = await Bus.countDocuments({
    ...matchQuery,
    status: 'idle',
    isActive: true,
  });

  const maintenanceBuses = await Bus.countDocuments({
    ...matchQuery,
    status: 'maintenance',
  });

  const activeRoutes = await Route.countDocuments({
    ...(depotId ? { depotId } : {}),
    status: 'active',
    isActive: true,
  });

  // Today's stats
  const todayTrips = await Trip.countDocuments({
    ...matchQuery,
    startTime: { $gte: todayStart },
  });

  const todayCompletedTrips = await Trip.countDocuments({
    ...matchQuery,
    startTime: { $gte: todayStart },
    status: 'completed',
  });

  // Today's notifications/delays
  const todayNotifications = await Notification.countDocuments({
    createdAt: { $gte: todayStart },
    type: { $in: ['delay', 'cancellation'] },
  });

  // Fleet overview with utilization
  const totalBuses = activeBuses + delayedBuses + idleBuses + maintenanceBuses;

  ApiResponse.success(res, {
    // Primary KPIs (as specified)
    activeBuses,
    delayedBuses,
    cancelledBuses,
    activeRoutes,

    // Extended insights
    idleBuses,
    maintenanceBuses,
    totalBuses,
    busUtilization: totalBuses > 0 ? Math.round((activeBuses / totalBuses) * 100) : 0,
    onTimePerformance: (activeBuses + delayedBuses) > 0
      ? Math.round((activeBuses / (activeBuses + delayedBuses)) * 100)
      : 100,
    
    // Today's operations
    todayTrips,
    todayCompletedTrips,
    completionRate: todayTrips > 0 ? Math.round((todayCompletedTrips / todayTrips) * 100) : 0,
    todayIncidents: todayNotifications,

    // Online users
    onlineUsers: getOnlineUsersCount(),

    // Timestamps
    timestamp: now.toISOString(),
    generatedAt: now.toISOString(),
  });
});

/**
 * @desc    Admin Dashboard - Complete system overview
 * @route   GET /api/dashboard/admin
 * 
 * Response:
 * {
 *   buses: 200,
 *   routes: 40,
 *   drivers: 100,
 *   users: 10000
 * }
 */
exports.getAdminDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ── Primary Stats ───────────────────────────────────────────────
  const [totalBuses, totalRoutes, totalDrivers, totalUsers] = await Promise.all([
    Bus.countDocuments({ isActive: true }),
    Route.countDocuments({ isActive: true }),
    Driver.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: true }),
  ]);

  // ── Bus Status Breakdown ────────────────────────────────────────
  const busStatusStats = await Bus.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const statusMap = {};
  busStatusStats.forEach(s => { statusMap[s._id] = s.count; });

  // ── Depot Overview ──────────────────────────────────────────────
  const [totalDepots, depotStats] = await Promise.all([
    Depot.countDocuments({ isActive: true }),
    Depot.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity.total' },
          currentOccupancy: { $sum: '$capacity.current' },
        },
      },
    ]),
  ]);

  // ── Today's Operations ──────────────────────────────────────────
  const [todayTrips, todayCompleted, todayDelays, newUsersToday] = await Promise.all([
    Trip.countDocuments({ startTime: { $gte: todayStart } }),
    Trip.countDocuments({ startTime: { $gte: todayStart }, status: 'completed' }),
    Trip.countDocuments({ startTime: { $gte: todayStart }, status: 'delayed' }),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
  ]);

  // ── Fleet Overview ──────────────────────────────────────────────
  const fleetOverview = await analyticsService.getFleetOverview();

  // ── Additional Insights ─────────────────────────────────────────
  const activeDrivers = await Driver.countDocuments({
    status: { $in: ['active', 'on-duty'] },
  });

  const totalBusCapacity = await Bus.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, total: { $sum: '$capacity' } } },
  ]);

  const topDepots = await Depot.find({ isActive: true })
    .select('name code stats.address.city')
    .sort({ 'stats.activeBuses': -1 })
    .limit(5)
    .lean();

  ApiResponse.success(res, {
    // Primary KPIs (as specified)
    buses: totalBuses,
    routes: totalRoutes,
    drivers: totalDrivers,
    users: totalUsers,

    // Bus status breakdown
    busStatus: {
      onRoute: statusMap['on-route'] || 0,
      delayed: statusMap['delayed'] || 0,
      idle: statusMap['idle'] || 0,
      maintenance: statusMap['maintenance'] || 0,
      cancelled: statusMap['cancelled'] || 0,
    },

    // Driver stats
    activeDrivers,
    availableDrivers: totalDrivers - activeDrivers,

    // Depot stats
    totalDepots,
    depotOccupancy: depotStats[0] || { totalCapacity: 0, currentOccupancy: 0 },

    // Fleet overview
    fleetUtilization: fleetOverview.busUtilization,
    onTimePerformance: fleetOverview.onTimePerformance,

    // Today's operations
    todayTrips,
    todayCompleted,
    todayDelays,
    completionRate: todayTrips > 0 ? Math.round((todayCompleted / todayTrips) * 100) : 0,
    newUsersToday,

    // Capacity
    totalCapacity: totalBusCapacity[0]?.total || 0,

    // Top depots
    topDepots,

    // Online users
    onlineUsers: getOnlineUsersCount(),

    timestamp: now.toISOString(),
    generatedAt: now.toISOString(),
  });
});

/**
 * @desc    Real-time monitoring dashboard data
 * @route   GET /api/dashboard/realtime
 */
exports.getRealtimeDashboard = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;

  const [activeBuses, delayedBuses, alerts, liveLocations] = await Promise.all([
    Bus.find({
      ...(depotId ? { depotId } : {}),
      status: 'on-route',
      isActive: true,
    })
      .select('number status currentLocation delay routeId')
      .populate('routeId', 'name number')
      .limit(50)
      .lean(),

    Bus.find({
      ...(depotId ? { depotId } : {}),
      status: 'delayed',
      isActive: true,
    })
      .select('number status currentLocation delay routeId')
      .populate('routeId', 'name number source destination')
      .lean(),

    Notification.find({
      createdAt: { $gte: new Date(Date.now() - 3600000) },
      severity: { $in: ['warning', 'critical', 'emergency'] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),

    Bus.find({
      ...(depotId ? { depotId } : {}),
      status: { $in: ['on-route', 'delayed'] },
      'currentLocation.lat': { $exists: true },
    })
      .select('number currentLocation status routeId')
      .populate('routeId', 'name number')
      .lean(),
  ]);

  const locations = liveLocations.map(b => ({
    busId: b._id,
    busNumber: b.number,
    lat: b.currentLocation?.lat,
    lng: b.currentLocation?.lng,
    speed: b.currentLocation?.speed || 0,
    status: b.status,
    route: b.routeId?.name || 'N/A',
  }));

  ApiResponse.success(res, {
    activeRoutes: activeBuses.length,
    activeBuses: activeBuses.map(b => ({
      id: b._id,
      number: b.number,
      route: b.routeId?.name || 'N/A',
      status: b.status,
      location: b.currentLocation,
    })),
    delayedBuses: delayedBuses.map(b => ({
      id: b._id,
      number: b.number,
      route: b.routeId?.name || 'N/A',
      delay: b.delay || 0,
      source: b.routeId?.source || 'Unknown',
      destination: b.routeId?.destination || 'Unknown',
    })),
    recentAlerts: alerts,
    liveLocations: locations,
    onlineUsers: getOnlineUsersCount(),
    timestamp: new Date().toISOString(),
  });
});
