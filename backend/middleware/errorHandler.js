const DB_UNAVAILABLE_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ECONNRESET',
  'PROTOCOL_CONNECTION_LOST',
  'ER_CON_COUNT_ERROR',
  'EACCES'
]);

const isDatabaseConnectionError = (err) => {
  if (!err) return false;
  if (err.code && DB_UNAVAILABLE_CODES.has(err.code)) return true;
  if (typeof err.message === 'string' && /ETIMEDOUT|ECONNREFUSED|ENOTFOUND|PROTOCOL_CONNECTION_LOST/i.test(err.message)) {
    return true;
  }
  return false;
};

const errorHandler = (err, req, res, next) => {
  console.error('SERVER ERROR:', {
    method: req.method,
    url: req.originalUrl,
    code: err.code || err.errno || 'UNKNOWN',
    message: err.message,
    stack: err.stack
  });

  if (isDatabaseConnectionError(err)) {
    return res.status(503).json({
      message: 'Server is temporarily unavailable, please try again'
    });
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};

module.exports = errorHandler;
