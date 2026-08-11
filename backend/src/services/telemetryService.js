const Bus = require('../models/Bus');
const Telemetry = require('../models/Telemetry');
const healthMonitoringService = require('./healthMonitoringService');
const driverSafetyService = require('./driverSafetyService');
const accidentDetectionService = require('./accidentDetectionService');
const predictiveMaintenanceService = require('./predictiveMaintenanceService');
const redisService = require('./redisService');
const logger = require('../utils/logger');
const { getIO } = require('../sockets');

/**
 * Telemetry ingestion pipeline.
 *
 * Single entry point for all sensor data (MQTT broker, HTTP endpoint and the
 * local simulator). Orchestrates:
 *   1. Persist raw telemetry          -> Telemetry model
 *   2. Health monitoring              -> Bus health status + notifications
 *   3. Driver safety analysis         -> unsafe events + safety score
 *   4. Accident detection             -> automatic emergency alerts
 *   5. Predictive maintenance         -> trend analysis + maintenance alerts
 */
class TelemetryService {
  /**
   * Validate a telemetry payload. Returns { isValid, errors, data }.
   */
  validate(data = {}) {
    const errors = [];
    const out = {};

    if (data.engineTemperature !== undefined) {
      if (typeof data.engineTemperature !== 'number') errors.push('engineTemperature must be a number');
      else out.engineTemperature = data.engineTemperature;
    }
    if (data.batteryVoltage !== undefined) {
      if (typeof data.batteryVoltage !== 'number') errors.push('batteryVoltage must be a number');
      else out.batteryVoltage = data.batteryVoltage;
    }
    if (data.currentDraw !== undefined) {
      if (typeof data.currentDraw !== 'number') errors.push('currentDraw must be a number');
      else out.currentDraw = data.currentDraw;
    }
    if (data.accelerometer !== undefined) {
      if (typeof data.accelerometer !== 'object') {
        errors.push('accelerometer must be an object {x,y,z}');
      } else {
        out.accelerometer = {
          x: Number(data.accelerometer.x) || 0,
          y: Number(data.accelerometer.y) || 0,
          z: Number(data.accelerometer.z) || 0,
        };
      }
    }
    if (data.gyroscope !== undefined) {
      if (typeof data.gyroscope !== 'object') {
        errors.push('gyroscope must be an object {x,y,z}');
      } else {
        out.gyroscope = {
          x: Number(data.gyroscope.x) || 0,
          y: Number(data.gyroscope.y) || 0,
          z: Number(data.gyroscope.z) || 0,
        };
      }
    }
    if (data.vibration !== undefined) {
      if (typeof data.vibration !== 'number') errors.push('vibration must be a number');
      else out.vibration = data.vibration;
    }
    if (data.speed !== undefined) {
      if (typeof data.speed !== 'number' || data.speed < 0) errors.push('speed must be a positive number');
      else out.speed = data.speed;
    }
    if (data.lat !== undefined) {
      if (typeof data.lat !== 'number' || data.lat < -90 || data.lat > 90) errors.push('lat out of range');
      else out.lat = data.lat;
    }
    if (data.lng !== undefined) {
      if (typeof data.lng !== 'number' || data.lng < -180 || data.lng > 180) errors.push('lng out of range');
      else out.lng = data.lng;
    }
    if (data.timestamp) {
      const parsed = new Date(data.timestamp);
      if (!Number.isNaN(parsed.getTime())) out.timestamp = parsed;
    }

    const hasAnyReading = out.engineTemperature !== undefined
      || out.batteryVoltage !== undefined
      || out.currentDraw !== undefined
      || out.accelerometer !== undefined
      || out.gyroscope !== undefined
      || out.vibration !== undefined;

    if (!hasAnyReading) {
      errors.push('payload must contain at least one sensor reading');
    }

    return { isValid: errors.length === 0, errors, data: out };
  }

  /**
   * Process a telemetry reading from a device.
   * @param {string} deviceId - registered bus device id
   * @param {object} rawData  - sensor payload
   */
  async processTelemetry(deviceId, rawData) {
    const { isValid, errors, data } = this.validate(rawData);
    if (!isValid) {
      logger.warn(`Invalid telemetry payload from ${deviceId}:`, errors);
      return { success: false, errors };
    }

    const bus = await Bus.findOne({ deviceId });
    if (!bus) {
      logger.warn(`Telemetry from unknown device ${deviceId}`);
      return { success: false, errors: ['Device not registered'] };
    }

    const reading = {
      ...data,
      location: data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : bus.currentLocation ? {
        lat: bus.currentLocation.lat,
        lng: bus.currentLocation.lng,
      } : undefined,
      timestamp: data.timestamp || new Date(),
    };

    // ── 1. Persist raw telemetry ───────────────────────────────────
    const telemetry = await Telemetry.create({
      busId: bus._id,
      deviceId,
      engineTemperature: reading.engineTemperature ?? null,
      batteryVoltage: reading.batteryVoltage ?? null,
      currentDraw: reading.currentDraw ?? null,
      accelerometer: reading.accelerometer || undefined,
      gyroscope: reading.gyroscope || undefined,
      vibration: reading.vibration ?? this.computeVibration(reading),
      speed: reading.speed ?? bus.currentLocation?.speed ?? 0,
      location: reading.location || undefined,
      timestamp: reading.timestamp,
    });

    // ── 2. Health monitoring ───────────────────────────────────────
    const health = await healthMonitoringService.applyToBus(bus, {
      ...reading,
      vibration: telemetry.vibration,
    });

    // ── 3. Driver safety analysis ──────────────────────────────────
    const safetyEvents = await driverSafetyService.processReading(bus, {
      ...reading,
      vibration: telemetry.vibration,
    });

    // ── 4. Accident detection ──────────────────────────────────────
    let accident = null;
    if (reading.accelerometer && this.hasImpact(reading.accelerometer)) {
      accident = await accidentDetectionService.detect(bus, {
        ...reading,
        vibration: telemetry.vibration,
      });
    }

    // ── 5. Predictive maintenance ──────────────────────────────────
    await predictiveMaintenanceService.recordReading(bus, reading);

    // ── Cache + broadcast ──────────────────────────────────────────
    await redisService.set(`bus:health:${bus._id}`, {
      busId: bus._id,
      busNumber: bus.number,
      status: health.status,
      engineTemperature: telemetry.engineTemperature,
      batteryVoltage: telemetry.batteryVoltage,
      currentDraw: telemetry.currentDraw,
      vibration: telemetry.vibration,
      updatedAt: telemetry.timestamp,
    }, 300);

    const io = getIO();
    if (io) {
      io.emit('busTelemetryUpdated', {
        telemetryId: telemetry._id,
        busId: bus._id,
        busNumber: bus.number,
        status: health.status,
        engineTemperature: telemetry.engineTemperature,
        batteryVoltage: telemetry.batteryVoltage,
        currentDraw: telemetry.currentDraw,
        vibration: telemetry.vibration,
        accelerometer: telemetry.accelerometer,
        gyroscope: telemetry.gyroscope,
        speed: telemetry.speed,
        timestamp: telemetry.timestamp,
      });
    }

    return {
      success: true,
      telemetry,
      health,
      safetyEvents: safetyEvents.length,
      accident: accident ? accident._id : null,
    };
  }

  /**
   * Compute vibration RMS from accelerometer axes (m/s²), excluding the
   * gravity component on the z-axis.
   */
  computeVibration(reading) {
    const a = reading.accelerometer;
    if (!a) return 0;
    const az = Math.max(0, Math.abs(a.z) - 9.81);
    return Math.round(
      Math.sqrt(a.x * a.x + a.y * a.y + az * az) * 100
    ) / 100;
  }

  hasImpact(accelerometer) {
    const magnitude = Math.sqrt(
      accelerometer.x * accelerometer.x
      + accelerometer.y * accelerometer.y
      + accelerometer.z * accelerometer.z
    );
    return magnitude >= 30;
  }
}

module.exports = new TelemetryService();
