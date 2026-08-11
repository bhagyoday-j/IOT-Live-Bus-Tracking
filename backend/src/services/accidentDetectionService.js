const logger = require('../utils/logger');
const SOSAlert = require('../models/SOSAlert');
const DriverEvent = require('../models/DriverEvent');
const Notification = require('../models/Notification');
const { getIO } = require('../sockets');

/**
 * Accident detection.
 *
 * Uses the accelerometer/gyroscope resultant magnitude to detect possible
 * accidents automatically (in addition to the driver's manual SOS button):
 *   - impact magnitude >= IMPACT_THRESHOLD m/s² triggers an emergency alert
 *   - bus ID + GPS coordinates are recorded
 *   - depot managers / admins are notified
 */
class AccidentDetectionService {
  constructor() {
    this.IMPACT_THRESHOLD = 30; // m/s² (~3g)
    this.DEDUPE_WINDOW_MS = 60 * 1000; // avoid duplicate alerts within 60s
  }

  /**
   * Detect a possible accident from a telemetry reading.
   * Returns the created SOS alert, or null.
   */
  async detect(bus, reading) {
    const { accelerometer, gyroscope } = reading;
    const ax = accelerometer?.x || 0;
    const ay = accelerometer?.y || 0;
    const az = accelerometer?.z || 0;

    // Resultant acceleration magnitude
    const resultant = Math.sqrt(ax * ax + ay * ay + az * az);
    const yawRate = Math.abs(gyroscope?.z || 0);
    const magnitude = Math.round(resultant * 10) / 10;

    const isImpact = resultant >= this.IMPACT_THRESHOLD;
    const isRollover = Math.abs(az) >= 28 && Math.abs(ax) >= 12; // sustained high lateral tilt

    if (!isImpact && !isRollover) return null;

    // Dedupe: don't fire another automatic alert for the same bus too quickly
    const recent = await SOSAlert.findOne({
      busId: bus._id,
      trigger: 'automatic',
      timestamp: { $gte: new Date(Date.now() - this.DEDUPE_WINDOW_MS) },
    });
    if (recent) {
      logger.info(`Accident alert for bus ${bus.number} suppressed (recent alert exists)`);
      return recent;
    }

    const timestamp = reading.timestamp || new Date();
    const alert = await SOSAlert.create({
      busId: bus._id,
      deviceId: bus.deviceId,
      driverId: bus.driverId || null,
      location: {
        type: 'Point',
        coordinates: [reading.location?.lng || 0, reading.location?.lat || 0],
      },
      speed: reading.speed || 0,
      heading: 0,
      timestamp,
      severity: 'critical',
      trigger: 'automatic',
      impact: { magnitude, type: isRollover ? 'rollover' : 'impact' },
    });

    // Mark bus in SOS state
    await bus.updateOne({ $set: { sosActive: true, sosActivatedAt: timestamp } });

    // Record an impact driving event + apply the safety-score penalty
    const driverSafetyService = require('./driverSafetyService');
    await DriverEvent.create({
      busId: bus._id,
      deviceId: bus.deviceId,
      driverId: bus.driverId || null,
      type: 'impact',
      severity: 'critical',
      magnitude,
      speed: reading.speed || 0,
      location: reading.location || undefined,
      isAccident: true,
      accidentAlertId: alert._id,
      timestamp,
    });
    await driverSafetyService.updateDriverScore(bus.driverId, 'impact');

    // Notify depot managers + admins
    await Notification.create({
      type: 'accident',
      title: `🚨 Possible accident detected – Bus ${bus.number}`,
      message: `Impact of ${magnitude} m/s² detected on bus ${bus.number} at [${reading.location?.lat || '—'}, ${reading.location?.lng || '—'}]. Emergency response advised.`,
      severity: 'emergency',
      busId: bus._id,
      routeId: bus.routeId || undefined,
      driverId: bus.driverId || undefined,
      data: { trigger: 'automatic', magnitude, lat: reading.location?.lat, lng: reading.location?.lng },
      audience: ['admins', 'depot_managers'],
    });

    logger.warn(`🚨 AUTOMATIC ACCIDENT DETECTED for bus ${bus.number} (${bus.deviceId}) magnitude=${magnitude} m/s²`);

    const io = getIO();
    if (io) {
      io.emit('accidentDetected', {
        alertId: alert._id,
        busId: bus._id,
        busNumber: bus.number,
        lat: reading.location?.lat,
        lng: reading.location?.lng,
        magnitude,
        timestamp,
      });
    }

    return alert;
  }
}

module.exports = new AccidentDetectionService();
