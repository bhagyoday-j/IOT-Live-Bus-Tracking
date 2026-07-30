const rateLimit = require('express-rate-limit');
const config = require('../config/index');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000 / 60),
    timestamp: new Date().toISOString(),
  },
});

// Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
    timestamp: new Date().toISOString(),
  },
});

// Device GPS data rate limiter
const gpsDataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // Max 300 GPS updates per minute per device (5/sec)
  keyGenerator: (req) => req.body?.deviceId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many GPS data requests. Please slow down.',
    timestamp: new Date().toISOString(),
  },
});

// SOS rate limiter
const sosLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: (req) => req.body?.deviceId || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many SOS requests. Emergency services have been notified.',
    timestamp: new Date().toISOString(),
  },
});

module.exports = { apiLimiter, authLimiter, gpsDataLimiter, sosLimiter };
