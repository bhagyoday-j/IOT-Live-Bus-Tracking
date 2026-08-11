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
      // Resolve real coordinates for every stop (route.stops subdocs do not
      // embed them — they live on the referenced Stop documents)
      const stops = await this.resolveStopLocations(route.stops);
      if (!stops.length) {
        return {
          nextStop: 'End of route',
          etaMinutes: 0,
          stops: [],
          status: 'completed',
        };
      }

      // Find current position relative to route
      const { nextStopIndex, nextStop } = this.findNextStop(stops, currentLocation);

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
        nextStop.lat, nextStop.lng
      );

      // Calculate ETA based on speed and traffic
      const currentSpeed = currentLocation.speed || bus.currentLocation?.speed || 30;
      const baseTime = (distanceToNext / Math.max(currentSpeed, 5)) * 60; // in minutes
      const trafficFactor = this.getTrafficFactor(currentSpeed, baseTime);
      const etaMinutes = Math.max(1, Math.round(baseTime * trafficFactor));

      // Calculate ETA for all remaining stops
      const remainingStops = [];
      let cumulativeTime = 0;

      for (let i = nextStopIndex; i < stops.length; i++) {
        const stop = stops[i];
        
        if (i > nextStopIndex) {
          const prevStop = stops[i - 1];
          const dist = this.calculateDistance(
            prevStop.lat, prevStop.lng,
            stop.lat, stop.lng
          );
          cumulativeTime += (dist / 25) * 60; // Average 25 km/h between stops
        }

        remainingStops.push({
          stopId: stop.stopId || stop.id,
          stopName: stop.name,
          order: stop.order,
          etaMinutes: Math.round(i === nextStopIndex ? etaMinutes : cumulativeTime),
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
   * Enrich route stops with real lat/lng coordinates.
   * Handles: populated stops (stop.stopId is a doc), raw stops with a
   * GeoJSON location, and plain ObjectId refs (fetched from the Stop model).
   */
  async resolveStopLocations(routeStops = []) {
    const stops = [];
    const missing = [];

    for (const stop of routeStops) {
      const populated = stop.stopId && typeof stop.stopId === 'object' ? stop.stopId : null;
      const coords = stop.location?.coordinates || populated?.location?.coordinates;

      if (coords?.length === 2) {
        stops.push({ ...stop, lat: coords[1], lng: coords[0] });
      } else if (stop.stopId) {
        missing.push(stop);
      } else if (stop.lat != null && stop.lng != null) {
        stops.push(stop);
      }
    }

    if (missing.length > 0) {
      try {
        const Stop = require('../models/Stop');
        const ids = missing.map((s) => s.stopId).filter(Boolean);
        const docs = await Stop.find({ _id: { $in: ids } }).lean();
        const byId = new Map(docs.map((d) => [d._id.toString(), d]));

        for (const stop of missing) {
          const doc = byId.get(stop.stopId.toString());
          const coords = doc?.location?.coordinates;
          stops.push({
            ...stop,
            lat: coords ? coords[1] : null,
            lng: coords ? coords[0] : null,
          });
        }
      } catch (error) {
        logger.error('Error resolving stop locations:', error.message);
        stops.push(...missing);
      }
    }

    return stops;
  }

  /**
   * Find the next stop a bus needs to reach based on current position
   * @param {Array} stops - route stops enriched with lat/lng
   */
  findNextStop(stops, currentLocation) {
    if (!stops?.length) return { nextStopIndex: -1, nextStop: null };

    let minDistance = Infinity;
    let nextStopIndex = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const dist = this.calculateDistance(
        currentLocation.lat, currentLocation.lng,
        stop.lat, stop.lng
      );

      if (dist < minDistance) {
        minDistance = dist;
        nextStopIndex = i;
      }
    }

    // The next stop is the one after the closest stop, or the closest if at the start
    const actualNextIndex = nextStopIndex < stops.length - 1 ? nextStopIndex + 1 : nextStopIndex;
    
    return {
      nextStopIndex: actualNextIndex,
      nextStop: stops[actualNextIndex],
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
