const { body, param } = require('express-validator');

const createRouteValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Route name is required'),
  body('number')
    .trim()
    .notEmpty()
    .withMessage('Route number is required'),
  body('source')
    .trim()
    .notEmpty()
    .withMessage('Source is required'),
  body('destination')
    .trim()
    .notEmpty()
    .withMessage('Destination is required'),
  body('totalDistance')
    .isFloat({ min: 0.1 })
    .withMessage('Total distance must be greater than 0'),
  body('totalDuration')
    .isInt({ min: 1 })
    .withMessage('Total duration must be at least 1 minute'),
  body('baseFare')
    .isFloat({ min: 0 })
    .withMessage('Base fare must be non-negative'),
  body('stops')
    .isArray({ min: 2 })
    .withMessage('At least 2 stops required'),
  body('stops.*.stopId')
    .isMongoId()
    .withMessage('Invalid stop ID'),
  body('stops.*.order')
    .isInt({ min: 1 })
    .withMessage('Stop order must be a positive integer'),
];

const updateRouteValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid route ID'),
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Route name cannot be empty'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'cancelled'])
    .withMessage('Invalid route status'),
];

const routeIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid route ID'),
];

module.exports = {
  createRouteValidator,
  updateRouteValidator,
  routeIdValidator,
};
