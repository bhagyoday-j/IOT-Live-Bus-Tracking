const jwt = require('jsonwebtoken');
const config = require('../config/index');
const User = require('../models/User');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Access denied. Invalid token format.');
    }

    const decoded = jwt.verify(token, config.jwt.secret);

    const user = await User.findById(decoded.userId)
      .select('-password -refreshToken');

    if (!user) {
      throw new UnauthorizedError('User not found. Token is invalid.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is deactivated. Contact administrator.');
    }

    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token expired'));
    }
    next(error);
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      if (user && user.isActive) {
        req.user = user;
        req.userId = user._id;
        req.userRole = user.role;
      }
    }
  } catch (error) {
    // Silently continue without auth
  }
  next();
};

// Device authentication middleware
const authenticateDevice = async (req, res, next) => {
  try {
    const { deviceId, deviceSecret } = req.body;

    if (!deviceId || !deviceSecret) {
      throw new UnauthorizedError('Device credentials required');
    }

    const Bus = require('../models/Bus');
    const bus = await Bus.findOne({ deviceId }).select('+deviceSecret');

    if (!bus) {
      throw new UnauthorizedError('Device not registered');
    }

    if (bus.deviceSecret !== deviceSecret) {
      throw new UnauthorizedError('Invalid device credentials');
    }

    req.bus = bus;
    req.deviceId = deviceId;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticate, optionalAuth, authenticateDevice };
