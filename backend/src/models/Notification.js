const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['delay', 'cancellation', 'arrival', 'route_change', 'sos', 'maintenance', 'system'],
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical', 'emergency'],
    default: 'info',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
  },
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
  },
  depotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Depot',
  },
  relatedEntity: {
    kind: { type: String },
    id: { type: mongoose.Schema.Types.ObjectId },
  },
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: { type: Date },
  isPushed: {
    type: Boolean,
    default: false,
  },
  pushedAt: { type: Date },
  expiresAt: { type: Date },
  audience: {
    type: [String],
    enum: ['all', 'passengers', 'depot_managers', 'admins', 'specific_users'],
    default: ['all'],
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
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

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ busId: 1 });
notificationSchema.index({ routeId: 1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // TTL: 30 days

module.exports = mongoose.model('Notification', notificationSchema);
