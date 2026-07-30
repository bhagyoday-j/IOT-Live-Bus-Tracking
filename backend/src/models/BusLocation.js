const mongoose = require('mongoose');

const busLocationSchema = new mongoose.Schema({
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
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  speed: {
    type: Number,
    default: 0,
    min: 0,
    max: 200,
  },
  heading: {
    type: Number,
    default: 0,
    min: 0,
    max: 360,
  },
  accuracy: {
    type: Number,
    default: 0,
  },
  altitude: { type: Number },
  sos: {
    type: Boolean,
    default: false,
  },
  odometer: { type: Number },
  batteryLevel: { type: Number },
  signalStrength: { type: Number },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes for efficient queries
busLocationSchema.index({ busId: 1, timestamp: -1 });
busLocationSchema.index({ deviceId: 1, timestamp: -1 });
busLocationSchema.index({ location: '2dsphere' });
busLocationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 }); // TTL: 24 hours
busLocationSchema.index({ sos: 1, timestamp: -1 });

// Static method to get latest location for a bus
busLocationSchema.statics.getLatestLocation = async function (busId) {
  return this.findOne({ busId })
    .sort({ timestamp: -1 })
    .lean();
};

// Static method to get location history for a bus
busLocationSchema.statics.getLocationHistory = async function (busId, minutes = 30) {
  const since = new Date(Date.now() - minutes * 60 * 1000);
  return this.find({
    busId,
    timestamp: { $gte: since },
  })
    .sort({ timestamp: 1 })
    .lean();
};

const BusLocation = mongoose.model('BusLocation', busLocationSchema);

module.exports = BusLocation;
