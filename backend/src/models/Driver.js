const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Driver name is required'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
  },
  license: {
    number: { type: String, required: true, unique: true },
    expiryDate: { type: Date, required: true },
    type: {
      type: String,
      enum: ['LMV', 'HMV', 'HTV', 'PSV'],
      default: 'PSV',
    },
  },
  experience: {
    type: Number,
    default: 0,
    min: 0,
  },
  rating: {
    type: Number,
    default: 4.0,
    min: 1,
    max: 5,
  },
  totalTrips: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-duty', 'off-duty', 'suspended'],
    default: 'active',
  },
  currentBusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bus',
    default: null,
  },
  assignedDepotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Depot',
  },
  emergencyContact: {
    name: { type: String },
    phone: { type: String },
    relation: { type: String },
  },
  address: { type: String },
  medicalCertificate: {
    validUntil: { type: Date },
    documentUrl: { type: String },
  },
  documents: {
    licenseFront: { type: String },
    licenseBack: { type: String },
    photo: { type: String },
  },
  isActive: { type: Boolean, default: true },
  lastLocation: {
    lat: { type: Number },
    lng: { type: Number },
    updatedAt: { type: Date },
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

driverSchema.index({ status: 1 });
driverSchema.index({ assignedDepotId: 1 });
driverSchema.index({ 'license.number': 1 });

module.exports = mongoose.model('Driver', driverSchema);
