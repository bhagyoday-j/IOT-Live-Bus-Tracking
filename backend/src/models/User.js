const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: {
      values: ['passenger', 'depot_manager', 'admin'],
      message: '{VALUE} is not a valid role',
    },
    default: 'passenger',
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s-]{7,15}$/, 'Please provide a valid phone number'],
  },
  avatar: { type: String },
  fcmToken: { type: String },
  depotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Depot',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: { type: Date },
  refreshToken: { type: String, select: false },
  preferences: {
    notifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: false },
    language: { type: String, default: 'en' },
  },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      delete ret.__v;
      ret.id = ret._id;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ depotId: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
