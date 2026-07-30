const { body } = require('express-validator');

const loginValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

const registerValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .trim(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{7,15}$/)
    .withMessage('Please provide a valid phone number'),
];

const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required'),
];

const forgotPasswordValidator = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

module.exports = {
  loginValidator,
  registerValidator,
  refreshTokenValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
};
