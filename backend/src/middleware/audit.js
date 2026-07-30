const logger = require('../utils/logger');

const auditLog = (action, resource) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    res.json = function (body) {
      const duration = Date.now() - startTime;

      const logEntry = {
        action,
        resource,
        userId: req.userId || 'anonymous',
        userRole: req.userRole || 'guest',
        method: req.method,
        path: req.originalUrl,
        params: req.params,
        query: req.query,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        timestamp: new Date().toISOString(),
      };

      // Mask sensitive data
      if (req.body?.password) logEntry.hasPassword = true;
      if (req.body?.deviceSecret) logEntry.hasDeviceSecret = true;

      // Log based on status code
      if (res.statusCode >= 400) {
        logger.warn('Audit - Failed Request:', logEntry);
      } else {
        logger.info('Audit - Success:', logEntry);
      }

      return originalJson(body);
    };

    next();
  };
};

// Request logger middleware (simpler version for high-frequency endpoints)
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
};

module.exports = { auditLog, requestLogger };
