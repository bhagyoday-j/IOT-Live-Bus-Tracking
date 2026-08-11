const mongoose = require('mongoose');

/**
 * DriverEvent – a detected unsafe driving / motion event.
 *
 * Generated from MPU6050 + speed deltas by the driver safety service:
 *   harsh_braking, sudden_acceleration, sharp_turn, excessive_vibration
 * and from high-magnitude impacts by the accident detection service:
 *   impact
 */
const driverEventSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  deviceId: {
    type: String,
    trim: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
  },
  type: {
    type: String,
    enum: [
      'harsh_braking',
      'sudden_acceleration',
      'sharp_turn',
      'excessive_vibration',
      'impact',
    ],
    required: true,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  magnitude: {
    type: Number,
    default: 0,
  },
  speed: {
    type: Number,
    default: 0,
  },
  location: {
    lat: { type: Number },
    lng: { type: Number },
  },
  isAccident: {
    type: Boolean,
    default: false,
  },
  accidentAlertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SOSAlert',
    default: null,
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

driverEventSchema.index({ busId: 1, timestamp: -1 });
driverEventSchema.index({ driverId: 1, timestamp: -1 });
driverEventSchema.index({ type: 1, timestamp: -1 });
driverEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

module.exports = mongoose.model('DriverEvent', driverEventSchema);
