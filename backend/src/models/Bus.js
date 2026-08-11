const mongoose = require('mongoose');

const busSchema = new mongoose.Schema({
  number: {
    type: String,
    required: [true, 'Bus number is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  deviceId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  deviceSecret: { type: String, select: false },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    default: null,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    default: null,
  },
  depotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Depot',
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: 10,
    max: 100,
  },
  currentPassengers: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['idle', 'on-route', 'delayed', 'cancelled', 'maintenance'],
    default: 'idle',
  },
  busType: {
    type: String,
    enum: ['standard', 'articulated', 'mini', 'double-decker', 'electric'],
    default: 'standard',
  },
  registrationYear: { type: Number },
  lastMaintenance: { type: Date },
  nextMaintenance: { type: Date },
  features: [{
    type: String,
    enum: ['ac', 'wifi', 'cctv', 'usb-charging', 'disabled-access', 'live-tracking'],
  }],
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    updatedAt: { type: Date },
  },
  delay: {
    type: Number,
    default: 0,
    min: 0,
  },
  health: {
    status: {
      type: String,
      enum: ['healthy', 'warning', 'critical', 'unknown'],
      default: 'unknown',
    },
    engineTemperature: { type: Number, default: null },
    batteryVoltage: { type: Number, default: null },
    currentDraw: { type: Number, default: null },
    vibration: { type: Number, default: 0 },
    lastEvent: { type: String, default: null },
    updatedAt: { type: Date, default: null },
  },
  isActive: { type: Boolean, default: true },
  sosActive: { type: Boolean, default: false },
  sosActivatedAt: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.deviceSecret;
      delete ret.__v;
      ret.id = ret._id;
      return ret;
    },
  },
});

busSchema.index({ deviceId: 1 });
busSchema.index({ status: 1 });
busSchema.index({ routeId: 1 });
busSchema.index({ depotId: 1 });
busSchema.index({ 'health.status': 1 });
busSchema.index({ 'currentLocation.lat': 1, 'currentLocation.lng': 1 });

module.exports = mongoose.model('Bus', busSchema);
