const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const Route = require('../models/Route');
const BusLocation = require('../models/BusLocation');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

class AnalyticsService {
  /**
   * Get real-time fleet overview statistics
   */
  async getFleetOverview(depotId = null) {
    try {
      const matchQuery = depotId ? { depotId } : {};
      matchQuery.isActive = true;

      const buses = await Bus.find(matchQuery);
      const totalBuses = buses.length;
      const activeBuses = buses.filter(b => b.status === 'on-route').length;
      const delayedBuses = buses.filter(b => b.status === 'delayed').length;
      const idleBuses = buses.filter(b => b.status === 'idle').length;
      const maintenanceBuses = buses.filter(b => b.status === 'maintenance').length;

      return {
        totalBuses,
        activeBuses,
        delayedBuses,
        idleBuses,
        maintenanceBuses,
        busUtilization: totalBuses > 0 ? Math.round((activeBuses / totalBuses) * 100) : 0,
        onTimePerformance: this.calculateOnTimePerformance(activeBuses, delayedBuses),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error getting fleet overview:', error.message);
      return this.getDefaultFleetStats();
    }
  }

  /**
   * Get route performance analytics
   */
  async getRoutePerformance(days = 7) {
    try {
      const since = new Date(Date.now() - days * 86400000);

      const routes = await Route.find({ isActive: true }).populate('assignedBuses');
      
      const performance = await Promise.all(
        routes.map(async (route) => {
          const trips = await Trip.find({
            routeId: route._id,
            startTime: { $gte: since },
          });

          const completedTrips = trips.filter(t => t.status === 'completed');
          const delayedTrips = trips.filter(t => t.delay > 5);
          const cancelledTrips = trips.filter(t => t.status === 'cancelled');
          
          const totalPassengers = completedTrips.reduce(
            (sum, t) => sum + (t.passengerCount?.boarded || 0), 0
          );
          
          const avgDelay = completedTrips.length > 0
            ? Math.round(completedTrips.reduce((sum, t) => sum + (t.delay || 0), 0) / completedTrips.length)
            : 0;

          return {
            routeId: route._id,
            routeName: route.name,
            routeNumber: route.number,
            totalTrips: trips.length,
            completedTrips: completedTrips.length,
            cancelledTrips: cancelledTrips.length,
            delayedTrips: delayedTrips.length,
            totalPassengers,
            averageDelay: avgDelay,
            onTimePercentage: completedTrips.length > 0
              ? Math.round(((completedTrips.length - delayedTrips.length) / completedTrips.length) * 100)
              : 100,
            assignedBuses: route.assignedBuses?.length || 0,
          };
        })
      );

      return performance;
    } catch (error) {
      logger.error('Error getting route performance:', error.message);
      return [];
    }
  }

  /**
   * Get delay trend data for charts
   */
  async getDelayTrends(days = 7) {
    try {
      const trends = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const [delays, cancellations, trips] = await Promise.all([
          Notification.countDocuments({
            type: 'delay',
            createdAt: { $gte: date, $lt: nextDate },
          }),
          Notification.countDocuments({
            type: 'cancellation',
            createdAt: { $gte: date, $lt: nextDate },
          }),
          Trip.countDocuments({
            startTime: { $gte: date, $lt: nextDate },
            status: { $ne: 'cancelled' },
          }),
        ]);

        trends.push({
          date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          delays,
          cancellations,
          totalTrips: trips,
          delayRate: trips > 0 ? Math.round((delays / trips) * 100) : 0,
        });
      }

      return trends;
    } catch (error) {
      logger.error('Error getting delay trends:', error.message);
      return [];
    }
  }

  /**
   * Get daily trip distribution by hour
   */
  async getDailyTripDistribution(date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const trips = await Trip.find({
        startTime: { $gte: startOfDay, $lt: endOfDay },
      });

      const hourlyData = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourTrips = trips.filter(t => {
          const tripHour = new Date(t.startTime).getHours();
          return tripHour === hour;
        });

        hourlyData.push({
          hour: `${hour.toString().padStart(2, '0')}:00`,
          trips: hourTrips.length,
          delayed: hourTrips.filter(t => t.delay > 5).length,
          passengers: hourTrips.reduce((sum, t) => sum + (t.passengerCount?.boarded || 0), 0),
        });
      }

      return hourlyData;
    } catch (error) {
      logger.error('Error getting trip distribution:', error.message);
      return [];
    }
  }

  /**
   * Get bus utilization statistics
   */
  async getBusUtilization(days = 30) {
    try {
      const since = new Date(Date.now() - days * 86400000);
      const buses = await Bus.find({ isActive: true });

      const utilization = await Promise.all(
        buses.map(async (bus) => {
          const trips = await Trip.find({
            busId: bus._id,
            startTime: { $gte: since },
          });

          const totalTripTime = trips.reduce((sum, t) => {
            if (t.startTime && t.endTime) {
              return sum + (t.endTime - t.startTime);
            }
            return sum;
          }, 0);

          const totalHours = (totalTripTime / (1000 * 60 * 60));
          const dailyHours = totalHours / days;

          return {
            busId: bus._id,
            busNumber: bus.number,
            totalTrips: trips.length,
            totalHours: Math.round(totalHours * 10) / 10,
            dailyAverageHours: Math.round(dailyHours * 10) / 10,
            utilizationRate: Math.min(100, Math.round((dailyHours / 12) * 100)), // Assuming 12h operating day
            currentStatus: bus.status,
          };
        })
      );

      return {
        buses: utilization,
        fleetAverage: utilization.length > 0
          ? Math.round(utilization.reduce((s, b) => s + b.utilizationRate, 0) / utilization.length)
          : 0,
      };
    } catch (error) {
      logger.error('Error getting bus utilization:', error.message);
      return { buses: [], fleetAverage: 0 };
    }
  }

  /**
   * Get active bus locations for heatmap (simplified)
   */
  async getBusLocationsForHeatmap() {
    try {
      const activeBuses = await Bus.find({
        status: { $in: ['on-route', 'delayed'] },
        'currentLocation.lat': { $exists: true },
      }).select('number currentLocation status routeId');

      return activeBuses.map(bus => ({
        lat: bus.currentLocation?.lat,
        lng: bus.currentLocation?.lng,
        weight: 1,
        busNumber: bus.number,
        status: bus.status,
      })).filter(loc => loc.lat && loc.lng);
    } catch (error) {
      logger.error('Error getting heatmap data:', error.message);
      return [];
    }
  }

  calculateOnTimePerformance(activeBuses, delayedBuses) {
    const total = activeBuses + delayedBuses;
    if (total === 0) return 100;
    return Math.round((activeBuses / total) * 100);
  }

  getDefaultFleetStats() {
    return {
      totalBuses: 0,
      activeBuses: 0,
      delayedBuses: 0,
      idleBuses: 0,
      maintenanceBuses: 0,
      busUtilization: 0,
      onTimePerformance: 100,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new AnalyticsService();
