const mongoose = require('mongoose');

const depotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Depot name is required'],
    trim: true,
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
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
  address: {
    street: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
  },
  phone: { type: String },
  email: { type: String },
  capacity: {
    total: { type: Number, required: true, min: 1 },
    current: { type: Number, default: 0 },
  },
  managers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  assignedRoutes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  }],
  facilities: [{
    type: String,
    enum: ['fuel-station', 'maintenance-bay', 'washing-bay', 'charging-station', 'parking', 'office', 'canteen'],
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'under-maintenance'],
    default: 'active',
  },
  operatingHours: {
    start: { type: String, default: '05:00' },
    end: { type: String, default: '23:00' },
  },
  stats: {
    totalBuses: { type: Number, default: 0 },
    activeBuses: { type: Number, default: 0 },
    totalDrivers: { type: Number, default: 0 },
    totalRoutes: { type: Number, default: 0 },
  },
  isActive: { type: Boolean, default: true },
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

depotSchema.index({ location: '2dsphere' });
depotSchema.index({ code: 1 });

module.exports = mongoose.model('Depot', depotSchema);
