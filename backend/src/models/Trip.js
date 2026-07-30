const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  },
  tripNumber: {
    type: String,
    required: true,
    trim: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: { type: Date },
  scheduledStart: { type: Date },
  scheduledEnd: { type: Date },
  status: {
    type: String,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'],
    default: 'scheduled',
  },
  delay: {
    type: Number,
    default: 0,
    min: 0,
  },
  delayReason: { type: String },
  startLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  endLocation: {
    lat: { type: Number },
    lng: { type: Number },
  },
  distanceCovered: {
    type: Number,
    default: 0,
  },
  passengerCount: {
    boarded: { type: Number, default: 0 },
    alighted: { type: Number, default: 0 },
    maxCapacity: { type: Number },
  },
  stopsVisited: [{
    stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop' },
    arrivalTime: { type: Date },
    departureTime: { type: Date },
    passengersBoarded: { type: Number, default: 0 },
    passengersAlighted: { type: Number, default: 0 },
    delayAtStop: { type: Number, default: 0 },
  }],
  routeDeviation: {
    detected: { type: Boolean, default: false },
    maxDeviation: { type: Number, default: 0 },
    deviationPath: { type: [[Number]] },
    correctedAt: { type: Date },
  },
  incidents: [{
    type: { type: String },
    description: { type: String },
    timestamp: { type: Date },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
  }],
  sosTriggered: {
    type: Boolean,
    default: false,
  },
  fuelConsumed: { type: Number },
  earnings: { type: Number },
  notes: { type: String },
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

tripSchema.index({ busId: 1, startTime: -1 });
tripSchema.index({ routeId: 1, startTime: -1 });
tripSchema.index({ driverId: 1, startTime: -1 });
tripSchema.index({ status: 1 });
tripSchema.index({ startTime: 1 }, { expireAfterSeconds: 7776000 }); // TTL: 90 days

module.exports = mongoose.model('Trip', tripSchema);
