const logger = require('../utils/logger');
const Bus = require('../models/Bus');
const Notification = require('../models/Notification');
const etaService = require('./etaService');

class DelayDetectionService {
  constructor() {
    this.DELAY_THRESHOLD_MINUTES = 5;
    this.SIGNIFICANT_DELAY_MINUTES = 15;
    this.CHECK_INTERVAL = 60000; // Check every minute
  }

  /**
   * Check a bus for delays based on GPS data and schedule
   */
  async checkBusDelay(bus, route, currentLocation) {
    try {
      if (!bus || !currentLocation) return null;

      const eta = await etaService.calculateETA(bus, route, currentLocation);
      
      // Compare actual vs expected time using route schedule
      const scheduledDelay = this.calculateScheduleDelay(bus, route);
      
      // Detect speed-based delays (traffic)
      const speedDelay = this.detectSpeedDelay(currentLocation.speed, route);
      
      // Detect route deviation
      const deviation = this.detectRouteDeviation(currentLocation, route);

      const totalDelay = Math.max(scheduledDelay, speedDelay);
      
      if (totalDelay >= this.DELAY_THRESHOLD_MINUTES || deviation.detected) {
        const delayInfo = {
          busId: bus._id,
          busNumber: bus.number,
          routeId: route?._id,
          routeName: route?.name,
          delay: totalDelay,
          delayType: deviation.detected ? 'route_deviation' : totalDelay >= this.SIGNIFICANT_DELAY_MINUTES ? 'significant' : 'minor',
          reasons: [],
          location: {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
          },
          timestamp: new Date().toISOString(),
        };

        if (scheduledDelay > 0) {
          delayInfo.reasons.push(`Behind schedule by ${scheduledDelay} minutes`);
        }
        if (speedDelay > 0) {
          delayInfo.reasons.push(`Traffic slowdown - current speed: ${currentLocation.speed || 0} km/h`);
        }
        if (deviation.detected) {
          delayInfo.reasons.push(`Route deviation detected - ${deviation.deviationMeters}m off route`);
          delayInfo.deviation = deviation;
        }

        // Create notification for significant delays
        if (totalDelay >= this.DELAY_THRESHOLD_MINUTES) {
          await this.createDelayNotification(bus, route, totalDelay, deviation.detected);
        }

        // Update bus delay status
        if (totalDelay >= this.DELAY_THRESHOLD_MINUTES && bus.status !== 'delayed') {
          await Bus.findByIdAndUpdate(bus._id, { 
            status: 'delayed', 
            delay: totalDelay,
          });
        }

        return delayInfo;
      }

      // If bus was delayed but now on time, reset status
      if (bus.status === 'delayed' && totalDelay < this.DELAY_THRESHOLD_MINUTES) {
        await Bus.findByIdAndUpdate(bus._id, { status: 'on-route', delay: 0 });
      }

      return null;
    } catch (error) {
      logger.error(`Delay detection error for bus ${bus._id}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate delay based on schedule comparison
   */
  calculateScheduleDelay(bus, route) {
    if (!route?.schedule?.length) return 0;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Find the scheduled departure for this time
    let scheduledMinute = 0;
    for (const sched of route.schedule) {
      const [hours, minutes] = sched.departure.split(':').map(Number);
      const schedMinutes = hours * 60 + minutes;
      if (schedMinutes <= currentMinutes) {
        scheduledMinute = schedMinutes;
      }
    }

    // Calculate delay based on trip duration
    if (scheduledMinute > 0) {
      const elapsedMinutes = currentMinutes - scheduledMinute;
      const expectedDuration = route.totalDuration || 30;
      
      if (elapsedMinutes > expectedDuration + this.DELAY_THRESHOLD_MINUTES) {
        return elapsedMinutes - expectedDuration;
      }
    }

    return 0;
  }

  /**
   * Detect delay based on speed (traffic congestion)
   */
  detectSpeedDelay(speed, route) {
    if (!speed && speed !== 0) return 0;
    
    if (speed < 5) return 15; // Stationary/heavy traffic
    if (speed < 10) return 10; // Heavy traffic
    if (speed < 20) return 5;  // Moderate traffic
    return 0; // Normal flow
  }

  /**
   * Detect if bus has deviated from its route
   */
  detectRouteDeviation(currentLocation, route, maxDeviationMeters = 200) {
    if (!route?.stops?.length || !currentLocation) {
      return { detected: false, deviationMeters: 0 };
    }

    let minDistance = Infinity;

    for (const stop of route.stops) {
      const stopLat = stop.location?.coordinates?.[1] || stop.lat;
      const stopLng = stop.location?.coordinates?.[0] || stop.lng;
      
      if (stopLat && stopLng) {
        const dist = etaService.calculateDistance(
          currentLocation.lat, currentLocation.lng,
          stopLat, stopLng
        ) * 1000; // Convert to meters

        if (dist < minDistance) {
          minDistance = dist;
        }
      }
    }

    // Also check route geometry if available
    if (route.geometry?.coordinates?.length > 1) {
      let minGeoDistance = Infinity;
      for (const coord of route.geometry.coordinates) {
        const dist = etaService.calculateDistance(
          currentLocation.lat, currentLocation.lng,
          coord[1], coord[0]
        ) * 1000;
        if (dist < minGeoDistance) minGeoDistance = dist;
      }
      minDistance = Math.min(minDistance, minGeoDistance);
    }

    return {
      detected: minDistance > maxDeviationMeters,
      deviationMeters: Math.round(minDistance),
    };
  }

  /**
   * Create notification for delayed/cancelled bus
   */
  async createDelayNotification(bus, route, delayMinutes, isDeviation = false) {
    try {
      const type = isDeviation ? 'route_change' : 'delay';
      const title = isDeviation ? 'Route Deviation Detected' : 'Bus Delayed';
      const message = isDeviation
        ? `Bus ${bus.number} on ${route?.name} has deviated from its route. Passengers may experience delays.`
        : `Bus ${bus.number} on ${route?.name} is delayed by ${delayMinutes} minutes due to ${delayMinutes > 15 ? 'heavy traffic' : 'traffic conditions'}.`;

      const notification = new Notification({
        type,
        title,
        message,
        severity: delayMinutes >= this.SIGNIFICANT_DELAY_MINUTES ? 'warning' : 'info',
        busId: bus._id,
        routeId: route?._id,
        data: {
          delayMinutes,
          isDeviation,
          busNumber: bus.number,
          routeName: route?.name,
        },
        audience: ['all'],
      });

      await notification.save();
      return notification;
    } catch (error) {
      logger.error('Error creating delay notification:', error.message);
      return null;
    }
  }

  /**
   * Check all active buses for delays
   */
  async checkAllActiveBuses() {
    try {
      const activeBuses = await Bus.find({ 
        status: { $in: ['on-route', 'delayed'] },
        isActive: true,
        'currentLocation.lat': { $exists: true },
      }).populate('routeId');

      const delays = [];
      
      for (const bus of activeBuses) {
        if (bus.currentLocation?.lat && bus.currentLocation?.lng) {
          const delayInfo = await this.checkBusDelay(
            bus,
            bus.routeId,
            bus.currentLocation
          );
          if (delayInfo) delays.push(delayInfo);
        }
      }

      return delays;
    } catch (error) {
      logger.error('Error checking all active buses:', error.message);
      return [];
    }
  }
}

module.exports = new DelayDetectionService();
