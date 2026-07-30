const { body, param } = require('express-validator');

const createDriverValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Driver name is required'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^\+?[\d\s-]{7,15}$/)
    .withMessage('Please provide a valid phone number'),
  body('license.number')
    .trim()
    .notEmpty()
    .withMessage('License number is required'),
  body('license.expiryDate')
    .isISO8601()
    .withMessage('Valid license expiry date is required'),
  body('experience')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Experience must be non-negative'),
  body('assignedDepotId')
    .optional()
    .isMongoId()
    .withMessage('Invalid depot ID'),
];

const updateDriverValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid driver ID'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'on-duty', 'off-duty', 'suspended'])
    .withMessage('Invalid driver status'),
];

const driverIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid driver ID'),
];

module.exports = {
  createDriverValidator,
  updateDriverValidator,
  driverIdValidator,
};
