const mongoose = require('mongoose');

/**
 * Telemetry – raw sensor snapshot from the in-bus IoT device.
 *
 * Captures engine temperature (DS18B20), battery voltage, current draw (ACS712),
 * and IMU data (MPU6050 accelerometer + gyroscope) so the backend can run
 * health monitoring, driver safety analysis, accident detection and predictive
 * maintenance.
 */
const telemetrySchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  deviceId: {
    type: String,
    required: true,
    trim: true,
  },
  // ── Engine / thermal ────────────────────────────────────────────
  engineTemperature: {
    type: Number,
    default: null,
  },
  // ── Electrical system ───────────────────────────────────────────
  batteryVoltage: {
    type: Number,
    default: null,
  },
  currentDraw: {
    type: Number,
    default: null,
  },
  // ── Motion / IMU (MPU6050) ──────────────────────────────────────
  accelerometer: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
  },
  gyroscope: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 },
  },
  vibration: {
    type: Number,
    default: 0,
  },
  // ── Context ─────────────────────────────────────────────────────
  speed: {
    type: Number,
    default: 0,
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.__v;
      ret.id = ret._id;
      return ret;
    },
  },
});

telemetrySchema.index({ busId: 1, timestamp: -1 });
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 172800 }); // TTL: 48 hours

module.exports = mongoose.model('Telemetry', telemetrySchema);
