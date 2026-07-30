const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Check if user is the owner of the resource or has admin role
const authorizeOwner = (paramIdField = 'id') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const resourceId = req.params[paramIdField];
      
      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      // Depot manager can access their depot resources
      if (req.user.role === 'depot_manager' && req.user.depotId) {
        req.depotId = req.user.depotId;
        return next();
      }

      // Check if user owns the resource
      if (resourceId && req.userId && resourceId === req.userId.toString()) {
        return next();
      }

      throw new ForbiddenError('You do not have permission to access this resource');
    } catch (error) {
      next(error);
    }
  };
};

// Check depot manager access to depot resources
const authorizeDepotAccess = () => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      if (req.user.role === 'admin') {
        return next();
      }

      if (req.user.role === 'depot_manager') {
        const depotId = req.params.depotId || req.body.depotId || req.query.depotId;
        
        if (depotId && depotId !== req.user.depotId?.toString()) {
          throw new ForbiddenError('You can only access resources in your assigned depot');
        }
        
        req.depotId = req.user.depotId;
        return next();
      }

      throw new ForbiddenError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { authorize, authorizeOwner, authorizeDepotAccess };
