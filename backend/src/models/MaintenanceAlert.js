const mongoose = require('mongoose');

/**
 * MaintenanceAlert – a predictive maintenance finding.
 *
 * The predictive maintenance service analyzes temperature / battery /
 * current / vibration trends and raises alerts such as:
 *   "Bus #12 may require maintenance within the next 5 days."
 */
const maintenanceAlertSchema = new mongoose.Schema({
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    required: true,
  },
  busNumber: {
    type: String,
    required: true,
    trim: true,
  },
  alertType: {
    type: String,
    enum: ['overheating', 'battery', 'electrical', 'vibration', 'general'],
    required: true,
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'warning',
  },
  message: {
    type: String,
    required: true,
  },
  predictedDaysUntilFailure: {
    type: Number,
    default: null,
  },
  status: {
    type: String,
    enum: ['open', 'scheduled', 'resolved', 'dismissed'],
    default: 'open',
  },
  evidence: {
    latestReading: { type: Number },
    baselineReading: { type: Number },
    trendSlope: { type: Number },
    samples: { type: Number },
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolvedAt: { type: Date },
  resolutionNotes: { type: String },
  detectedAt: {
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

maintenanceAlertSchema.index({ busId: 1, status: 1 });
maintenanceAlertSchema.index({ status: 1, detectedAt: -1 });
maintenanceAlertSchema.index({ alertType: 1 });

module.exports = mongoose.model('MaintenanceAlert', maintenanceAlertSchema);
