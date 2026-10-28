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
  // mysql2 wraps multi-address failures in an AggregateError
  if (Array.isArray(err.errors) && err.errors.some((e) => e && DB_UNAVAILABLE_CODES.has(e.code))) {
    return true;
  }
  return false;
};

module.exports = { isDatabaseConnectionError };

