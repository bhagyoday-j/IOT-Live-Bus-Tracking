const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/index');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/apiResponse');
const { UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry }
  );

  const refreshToken = jwt.sign(
    { userId, role },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry }
  );

  return { accessToken, refreshToken };
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return ApiResponse.error(res, 'Email already registered', 409);
  }

  const user = await User.create({ name, email, password, phone });
  const tokens = generateTokens(user._id, user.role);

  logger.info(`New user registered: ${email}`);

  ApiResponse.created(res, {
    user: user.toJSON(),
    ...tokens,
  }, 'Registration successful');
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    return ApiResponse.unauthorized(res, 'Invalid email or password');
  }

  if (!user.isActive) {
    return ApiResponse.forbidden(res, 'Account is deactivated');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return ApiResponse.unauthorized(res, 'Invalid email or password');
  }

  await user.updateLastLogin();
  const tokens = generateTokens(user._id, user.role);

  logger.info(`User logged in: ${email}`);

  ApiResponse.success(res, {
    user: user.toJSON(),
    ...tokens,
  }, 'Login successful');
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return ApiResponse.badRequest(res, 'Refresh token is required');
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
  } catch (error) {
    return ApiResponse.unauthorized(res, 'Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) {
    return ApiResponse.unauthorized(res, 'User not found or inactive');
  }

  const tokens = generateTokens(user._id, user.role);

  ApiResponse.success(res, {
    user: user.toJSON(),
    ...tokens,
  }, 'Token refreshed successfully');
});

exports.getProfile = asyncHandler(async (req, res) => {
  ApiResponse.success(res, { user: req.user });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'phone', 'preferences'];
  const updates = {};
  
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  ApiResponse.success(res, { user: user.toJSON() }, 'Profile updated');
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId).select('+password');
  const isMatch = await user.comparePassword(currentPassword);

  if (!isMatch) {
    return ApiResponse.unauthorized(res, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();

  ApiResponse.success(res, null, 'Password changed successfully');
});

exports.logout = asyncHandler(async (req, res) => {
  // In a real app, you'd blacklist the token or remove it from a whitelist
  ApiResponse.success(res, null, 'Logged out successfully');
});
