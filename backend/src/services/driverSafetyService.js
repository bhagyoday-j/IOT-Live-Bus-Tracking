const logger = require('../utils/logger');
const DriverEvent = require('../models/DriverEvent');
const Driver = require('../models/Driver');
const { getIO } = require('../sockets');

/**
 * Driver safety analysis (MPU6050 + speed deltas).
 *
 * Detects unsafe driving events:
 *   - harsh_braking          forward deceleration > 3.5 m/s² or >15 km/h drop
 *   - sudden_acceleration    forward acceleration > 2.5 m/s² or >10 km/h surge
 *   - sharp_turn             lateral acceleration > 3.0 m/s² at speed, or yaw rate > 45 °/s
 *   - excessive_vibration    vibration RMS > 2.5 m/s²
 *   - impact                 resultant acceleration > 25 m/s² (accident candidate)
 *
 * Each detected event lowers the driver's safety score.
 */
class DriverSafetyService {
  constructor() {
    // deviceId -> { lastSpeed, lastTime }
    this.deviceState = new Map();

    // Penalty weights applied to the driver safety score
    this.PENALTIES = {
      harsh_braking: 2.0,
      sudden_acceleration: 1.5,
      sharp_turn: 2.0,
      excessive_vibration: 1.0,
      impact: 10.0,
    };
    this.RECOVERY_PER_DAY = 0.5;
  }

  /**
   * Process a telemetry reading and return any detected events.
   */
  async processReading(bus, reading) {
    try {
      const events = this.detectEvents(bus, reading);
      if (!events.length) return events;

      const savedEvents = [];
      for (const event of events) {
        const doc = await DriverEvent.create({
          busId: bus._id,
          deviceId: bus.deviceId,
          driverId: bus.driverId || null,
          type: event.type,
          severity: event.severity,
          magnitude: event.magnitude,
          speed: reading.speed || 0,
          location: reading.location || undefined,
          isAccident: false,
          timestamp: reading.timestamp || new Date(),
        });

        // Update driver safety counters + score (skip impact — handled by accident pipeline)
        if (event.type !== 'impact') {
          await this.updateDriverScore(bus.driverId, event.type);
        }

        savedEvents.push(doc);

        const io = getIO();
        if (io) {
          io.emit('driverEventDetected', {
            eventId: doc._id,
            busId: bus._id,
            busNumber: bus.number,
            driverId: bus.driverId,
            type: event.type,
            severity: event.severity,
            magnitude: event.magnitude,
            speed: reading.speed || 0,
            timestamp: doc.timestamp,
          });
        }

        logger.warn(`[Safety] ${event.type.toUpperCase()} on bus ${bus.number} (${event.magnitude.toFixed(1)})`);
      }

      return savedEvents;
    } catch (error) {
      logger.error(`Driver safety processing error for bus ${bus._id}:`, error.message);
      return [];
    }
  }

  /**
   * Detect unsafe events from a single telemetry reading.
   */
  detectEvents(bus, reading) {
    const events = [];
    const { accelerometer, gyroscope } = reading;
    const speed = reading.speed || 0;
    const timestamp = (reading.timestamp || new Date()).getTime();
    const state = this.deviceState.get(bus.deviceId) || { lastSpeed: null, lastTime: null };

    const ax = accelerometer?.x || 0;
    const ay = accelerometer?.y || 0;
    const az = accelerometer?.z || 0;
    const gz = gyroscope?.z || 0;

    // Note: impact (accident) events are handled exclusively by the
    // accidentDetectionService at a single shared threshold of 30 m/s².

    // ── Speed-delta based detection (longitudinal) ─────────────────
    if (state.lastSpeed != null && state.lastTime != null) {
      const dtSeconds = (timestamp - state.lastTime) / 1000;
      const speedDelta = speed - state.lastSpeed;

      if (dtSeconds > 0 && dtSeconds < 30 && Math.abs(speedDelta) > 3) {
        const accelMS2 = (speedDelta / 3.6) / dtSeconds; // km/h -> m/s, per second

        // Harsh braking
        if (accelMS2 <= -3.5 || speedDelta <= -15) {
          events.push({
            type: 'harsh_braking',
            severity: accelMS2 <= -5 ? 'high' : 'medium',
            magnitude: Math.round(Math.abs(accelMS2) * 10) / 10,
          });
        }
        // Sudden acceleration
        if (accelMS2 >= 2.5 || speedDelta >= 10) {
          events.push({
            type: 'sudden_acceleration',
            severity: accelMS2 >= 4 ? 'high' : 'medium',
            magnitude: Math.round(accelMS2 * 10) / 10,
          });
        }
      }
    }

    // ── IMU based detection (lateral / rotation) ───────────────────
    // Accelerometer axes are m/s²; gyroscope is °/s.
    const latAccel = Math.abs(ax);
    const yawRate = Math.abs(gz);

    if (speed > 20 && latAccel >= 3.0) {
      events.push({
        type: 'sharp_turn',
        severity: latAccel >= 5 ? 'high' : 'medium',
        magnitude: Math.round(latAccel * 10) / 10,
      });
    } else if (speed > 20 && yawRate >= 45) {
      events.push({
        type: 'sharp_turn',
        severity: yawRate >= 70 ? 'high' : 'medium',
        magnitude: Math.round(yawRate * 10) / 10,
      });
    }

    // ── Vibration ──────────────────────────────────────────────────
    // Fallback RMS excludes the gravity component on the z-axis.
    const vibration = reading.vibration
      || Math.sqrt(ax * ax + ay * ay + Math.pow(Math.max(0, Math.abs(az) - 9.81), 2));
    if (vibration >= 2.5) {
      events.push({
        type: 'excessive_vibration',
        severity: vibration >= 4 ? 'high' : 'medium',
        magnitude: Math.round(vibration * 10) / 10,
      });
    }

    // Update per-device state
    if (speed >= 0) {
      this.deviceState.set(bus.deviceId, {
        lastSpeed: speed,
        lastTime: timestamp,
      });
    }

    return events;
  }

  /**
   * Apply the penalty of an event to the driver's safety score.
   */
  async updateDriverScore(driverId, eventType) {
    if (!driverId) return null;

    try {
      const driver = await Driver.findById(driverId);
      if (!driver) return null;

      const safety = driver.safety || {};
      const penalty = this.PENALTIES[eventType] || 1;

      const counters = {
        harshBraking: safety.harshBraking || 0,
        suddenAcceleration: safety.suddenAcceleration || 0,
        sharpTurns: safety.sharpTurns || 0,
        excessiveVibration: safety.excessiveVibration || 0,
      };
      if (eventType === 'harsh_braking') counters.harshBraking += 1;
      if (eventType === 'sudden_acceleration') counters.suddenAcceleration += 1;
      if (eventType === 'sharp_turn') counters.sharpTurns += 1;
      if (eventType === 'excessive_vibration') counters.excessiveVibration += 1;

      const totalEvents = (safety.totalEvents || 0) + 1;
      // Slow recovery when driving cleanly
      const lastEventAt = safety.lastEventAt ? new Date(safety.lastEventAt) : null;
      const daysClean = lastEventAt
        ? Math.floor((Date.now() - lastEventAt.getTime()) / 86400000)
        : 0;
      const recovery = Math.min(daysClean * this.RECOVERY_PER_DAY, 5);

      const score = Math.max(0, Math.min(100, (safety.score ?? 100) - penalty + recovery));
      const trend = totalEvents > 15 ? 'declining' : score >= 92 ? 'improving' : 'stable';

      await Driver.findByIdAndUpdate(driverId, {
        $set: {
          'safety.score': Math.round(score * 10) / 10,
          'safety.totalEvents': totalEvents,
          'safety.harshBraking': counters.harshBraking,
          'safety.suddenAcceleration': counters.suddenAcceleration,
          'safety.sharpTurns': counters.sharpTurns,
          'safety.excessiveVibration': counters.excessiveVibration,
          'safety.trend': trend,
          'safety.lastEventAt': new Date(),
        },
      });

      return { score, totalEvents };
    } catch (error) {
      logger.error('Error updating driver safety score:', error.message);
      return null;
    }
  }

  /**
   * Recompute a driver's score from their stored event history (for reports).
   */
  async recomputeScore(driverId) {
    if (!driverId) return null;
    const events = await DriverEvent.find({ driverId }).lean();
    let score = 100;
    const counters = { harsh_braking: 0, sudden_acceleration: 0, sharp_turn: 0, excessive_vibration: 0, impact: 0 };
    events.forEach((e) => {
      counters[e.type] = (counters[e.type] || 0) + 1;
      score -= this.PENALTIES[e.type] || 1;
    });
    return {
      score: Math.max(0, Math.round(score * 10) / 10),
      totalEvents: events.length,
      counters,
    };
  }
}

module.exports = new DriverSafetyService();
