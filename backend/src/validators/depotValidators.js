const { body, param } = require('express-validator');

const createDepotValidator = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Depot name is required'),
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Depot code is required'),
  body('location.coordinates')
    .isArray({ min: 2, max: 2 })
    .withMessage('Location coordinates [lng, lat] are required'),
  body('location.coordinates.*')
    .isFloat()
    .withMessage('Invalid coordinate value'),
  body('capacity.total')
    .isInt({ min: 1 })
    .withMessage('Total capacity must be at least 1'),
  body('address.city')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('City cannot be empty'),
];

const updateDepotValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid depot ID'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'under-maintenance'])
    .withMessage('Invalid depot status'),
];

const depotIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid depot ID'),
];

module.exports = {
  createDepotValidator,
  updateDepotValidator,
  depotIdValidator,
};
