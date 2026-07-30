const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Stop name is required'],
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
  address: { type: String },
  landmark: { type: String },
  amenities: [{
    type: String,
    enum: ['shelter', 'bench', 'lighting', 'display-board', 'ticket-machine', 'wifi', 'cctv', 'wheelchair-access'],
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'under-maintenance'],
    default: 'active',
  },
  routes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
  }],
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

stopSchema.index({ location: '2dsphere' });
stopSchema.index({ code: 1 });

module.exports = mongoose.model('Stop', stopSchema);
