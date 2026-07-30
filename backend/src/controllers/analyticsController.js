const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const analyticsService = require('../services/analyticsService');

exports.getDashboardOverview = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;

  const [overview, routePerformance, delayTrends, tripDistribution] = await Promise.all([
    analyticsService.getFleetOverview(depotId),
    analyticsService.getRoutePerformance(7),
    analyticsService.getDelayTrends(7),
    analyticsService.getDailyTripDistribution(),
  ]);

  ApiResponse.success(res, {
    overview,
    routePerformance,
    delayTrends,
    tripDistribution,
  });
});

exports.getFleetOverview = asyncHandler(async (req, res) => {
  const depotId = req.query.depotId || req.depotId;
  const overview = await analyticsService.getFleetOverview(depotId);
  ApiResponse.success(res, { overview });
});

exports.getRoutePerformance = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const performance = await analyticsService.getRoutePerformance(days);
  ApiResponse.success(res, { performance });
});

exports.getDelayTrends = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  const trends = await analyticsService.getDelayTrends(days);
  ApiResponse.success(res, { trends });
});

exports.getTripDistribution = asyncHandler(async (req, res) => {
  const distribution = await analyticsService.getDailyTripDistribution();
  ApiResponse.success(res, { distribution });
});

exports.getBusUtilization = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const utilization = await analyticsService.getBusUtilization(days);
  ApiResponse.success(res, { utilization });
});

exports.getHeatmapData = asyncHandler(async (req, res) => {
  const locations = await analyticsService.getBusLocationsForHeatmap();
  ApiResponse.success(res, { locations, count: locations.length });
});
