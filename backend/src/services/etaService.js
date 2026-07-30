const axios = require('axios');
const config = require('../config/index');
const logger = require('../utils/logger');
const redisService = require('./redisService');

class ETAService {
  constructor() {
    this.cacheTTL = 60; // Cache ETA for 60 seconds
  }

  /**
   * Calculate ETA for a bus to reach its next stop and all subsequent stops
   */
  async calculateETA(bus, route, currentLocation) {
    try {
      // Find current position relative to route
      const { nextStopIndex, nextStop } = this.findNextStop(route, currentLocation);

      if (!nextStop) {
        return {
          nextStop: 'End of route',
          etaMinutes: 0,
          stops: [],
          status: 'completed',
        };
      }

      // Get distance to next stop
      const distanceToNext = this.calculateDistance(
        currentLocation.lat, currentLocation.lng,
        nextStop.location?.coordinates?.[1] || nextStop.lat,
        nextStop.location?.coordinates?.[0] || nextStop.lng
      );

      // Calculate ETA based on speed and traffic
      const currentSpeed = currentLocation.speed || bus.currentLocation?.speed || 30;
      const baseTime = (distanceToNext / Math.max(currentSpeed, 5)) * 60; // in minutes
      const trafficFactor = this.getTrafficFactor(currentSpeed, baseTime);
      const etaMinutes = Math.max(1, Math.round(baseTime * trafficFactor));

      // Calculate ETA for all remaining stops
      const remainingStops = [];
      let cumulativeTime = 0;

      for (let i = nextStopIndex; i < route.stops.length; i++) {
        const stop = route.stops[i];
        
        if (i > nextStopIndex) {
          const prevStop = route.stops[i - 1];
          const dist = this.calculateDistance(
            prevStop.location?.coordinates?.[1] || prevStop.lat,
            prevStop.location?.coordinates?.[0] || prevStop.lng,
            stop.location?.coordinates?.[1] || stop.lat,
            stop.location?.coordinates?.[0] || stop.lng
          );
          cumulativeTime += (dist / 25) * 60; // Average 25 km/h between stops
        }

        remainingStops.push({
          stopId: stop.stopId || stop.id,
          stopName: stop.name,
          order: stop.order,
          etaMinutes: Math.round((i === nextStopIndex ? etaMinutes : cumulativeTime)),
          distance: i === nextStopIndex ? Math.round(distanceToNext) : 0,
        });
      }

      // Cache the result
      await redisService.cacheBusLocation(`eta:${bus._id || bus.id}`, {
        nextStop: nextStop.name,
        etaMinutes,
        stops: remainingStops,
        calculatedAt: new Date().toISOString(),
      });

      return {
        nextStop: nextStop.name,
        etaMinutes,
        stops: remainingStops,
        status: 'on-route',
        calculatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`ETA calculation error for bus ${bus._id || bus.id}:`, error.message);
      return this.getFallbackETA(route, bus);
    }
  }

  /**
   * Find the next stop a bus needs to reach based on current position
   */
  findNextStop(route, currentLocation) {
    if (!route?.stops?.length) return { nextStopIndex: -1, nextStop: null };

    let minDistance = Infinity;
    let nextStopIndex = 0;

    for (let i = 0; i < route.stops.length; i++) {
      const stop = route.stops[i];
      const dist = this.calculateDistance(
        currentLocation.lat, currentLocation.lng,
        stop.location?.coordinates?.[1] || stop.lat,
        stop.location?.coordinates?.[0] || stop.lng
      );

      if (dist < minDistance) {
        minDistance = dist;
        nextStopIndex = i;
      }
    }

    // The next stop is the one after the closest stop, or the closest if at the start
    const actualNextIndex = nextStopIndex < route.stops.length - 1 ? nextStopIndex + 1 : nextStopIndex;
    
    return {
      nextStopIndex: actualNextIndex,
      nextStop: route.stops[actualNextIndex],
    };
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get traffic factor based on speed relative to expected speed
   */
  getTrafficFactor(currentSpeed, baseTime) {
    if (currentSpeed < 10) return 1.5; // Heavy traffic
    if (currentSpeed < 20) return 1.3; // Moderate traffic
    if (currentSpeed < 30) return 1.1; // Light traffic
    return 1.0; // Normal flow
  }

  /**
   * Get fallback ETA from route schedule if real-time calculation fails
   */
  getFallbackETA(route, bus) {
    if (!route?.schedule?.length) {
      return {
        nextStop: 'Unknown',
        etaMinutes: 15,
        stops: [],
        status: 'estimated',
        calculatedAt: new Date().toISOString(),
      };
    }

    // Use scheduled times
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Find next scheduled departure
    for (const sched of route.schedule) {
      const [hours, minutes] = sched.departure.split(':').map(Number);
      const schedMinutes = hours * 60 + minutes;
      if (schedMinutes > currentMinutes) {
        return {
          nextStop: route.stops[1]?.name || 'Next stop',
          etaMinutes: schedMinutes - currentMinutes,
          stops: [],
          status: 'scheduled',
          calculatedAt: new Date().toISOString(),
        };
      }
    }

    return {
      nextStop: route.stops[1]?.name || 'Next stop',
      etaMinutes: 15,
      stops: [],
      status: 'estimated',
      calculatedAt: new Date().toISOString(),
    };
  }
}

module.exports = new ETAService();
