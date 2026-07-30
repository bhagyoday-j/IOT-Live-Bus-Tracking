const { body, param, query } = require('express-validator');

const createBusValidator = [
  body('number')
    .trim()
    .notEmpty()
    .withMessage('Bus number is required')
    .isLength({ min: 3, max: 20 })
    .withMessage('Bus number must be between 3 and 20 characters'),
  body('capacity')
    .isInt({ min: 10, max: 100 })
    .withMessage('Capacity must be between 10 and 100'),
  body('busType')
    .optional()
    .isIn(['standard', 'articulated', 'mini', 'double-decker', 'electric'])
    .withMessage('Invalid bus type'),
  body('routeId')
    .optional()
    .isMongoId()
    .withMessage('Invalid route ID'),
  body('driverId')
    .optional()
    .isMongoId()
    .withMessage('Invalid driver ID'),
  body('depotId')
    .optional()
    .isMongoId()
    .withMessage('Invalid depot ID'),
];

const updateBusValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bus ID'),
  body('number')
    .optional()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Bus number must be between 3 and 20 characters'),
  body('capacity')
    .optional()
    .isInt({ min: 10, max: 100 })
    .withMessage('Capacity must be between 10 and 100'),
  body('status')
    .optional()
    .isIn(['idle', 'on-route', 'delayed', 'cancelled', 'maintenance'])
    .withMessage('Invalid bus status'),
];

const busIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid bus ID'),
];

const deviceGpsValidator = [
  body('deviceId')
    .trim()
    .notEmpty()
    .withMessage('Device ID is required'),
  body('deviceSecret')
    .notEmpty()
    .withMessage('Device secret is required'),
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('lng')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('speed')
    .optional()
    .isFloat({ min: 0, max: 200 })
    .withMessage('Speed must be between 0 and 200'),
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360'),
];

module.exports = {
  createBusValidator,
  updateBusValidator,
  busIdValidator,
  deviceGpsValidator,
};
