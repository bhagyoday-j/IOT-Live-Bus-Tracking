const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));
    
    throw new ValidationError(formattedErrors);
  }
  
  next();
};

// Sanitization helpers
const sanitizers = {
  trimStrings: (req, res, next) => {
    if (req.body) {
      Object.keys(req.body).forEach((key) => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = req.body[key].trim();
        }
      });
    }
    next();
  },
  
  normalizeEmail: (req, res, next) => {
    if (req.body?.email) {
      req.body.email = req.body.email.toLowerCase().trim();
    }
    next();
  },
  
  toUppercase: (fields) => (req, res, next) => {
    fields.forEach((field) => {
      if (req.body?.[field]) {
        req.body[field] = req.body[field].toUpperCase().trim();
      }
    });
    next();
  },
};

module.exports = { validate, sanitizers };
