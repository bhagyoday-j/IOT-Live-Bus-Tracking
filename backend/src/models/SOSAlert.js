const mongoose = require('mongoose');

const sosAlertSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  deviceId: {
    type: String,
    required: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
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
  speed: { type: Number },
  heading: { type: Number },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['active', 'acknowledged', 'resolved', 'false-alarm'],
    default: 'active',
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  acknowledgedAt: { type: Date },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: { type: Date },
  resolution: {
    action: { type: String },
    notes: { type: String },
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high',
  },
  notificationsSent: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    channel: { type: String },
    sent: { type: Boolean },
    sentAt: { type: Date },
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

sosAlertSchema.index({ busId: 1, timestamp: -1 });
sosAlertSchema.index({ status: 1 });
sosAlertSchema.index({ timestamp: -1 });
sosAlertSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SOSAlert', sosAlertSchema);
