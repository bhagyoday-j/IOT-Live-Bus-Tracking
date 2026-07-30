const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  stopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop',
    required: true,
  },
  name: { type: String, required: true },
  order: { type: Number, required: true },
  distanceFromStart: { type: Number, default: 0 },
  etaFromStart: { type: Number, default: 0 },
});

const routeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Route name is required'],
    trim: true,
  },
  number: {
    type: String,
    required: [true, 'Route number is required'],
    unique: true,
    uppercase: true,
    trim: true,
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    trim: true,
  },
  destination: {
    type: String,
    required: [true, 'Destination is required'],
    trim: true,
  },
  sourceStopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop',
  },
  destinationStopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stop',
  },
  stops: [stopSchema],
  totalDistance: {
    type: Number,
    required: true,
    min: 0.1,
  },
  totalDuration: {
    type: Number,
    required: true,
    min: 1,
  },
  baseFare: {
    type: Number,
    required: true,
    min: 0,
  },
  farePerKm: {
    type: Number,
    default: 1.5,
    min: 0,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'cancelled'],
    default: 'active',
  },
  direction: {
    type: String,
    enum: ['up', 'down', 'circular', 'bidirectional'],
    default: 'bidirectional',
  },
  depotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Depot',
  },
  operatingHours: {
    start: { type: String, default: '06:00' },
    end: { type: String, default: '22:00' },
  },
  frequency: {
    peakHours: { type: Number, default: 10 },
    offPeakHours: { type: Number, default: 20 },
  },
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
    },
    coordinates: { type: [[Number]] },
  },
  assignedBuses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
  }],
  isActive: { type: Boolean, default: true },
  schedule: [{
    departure: { type: String },
    arrival: { type: String },
    busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' },
  }],
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

routeSchema.index({ number: 1 });
routeSchema.index({ status: 1 });
routeSchema.index({ depotId: 1 });
routeSchema.index({ source: 'text', destination: 'text' });

module.exports = mongoose.model('Route', routeSchema);
