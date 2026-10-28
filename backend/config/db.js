const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').trim(),
  user: (process.env.DB_USER || 'smis').trim(),
  password: process.env.DB_PASSWORD || 'smis',
  database: (process.env.DB_NAME || 'smis').trim(),
  port: parseInt((process.env.DB_PORT || '3306').trim(), 10) || 3306,
  connectTimeout: 20000,
  waitForConnections: true,
  connectionLimit: 5,
  maxIdle: 5,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 5000,
  dateStrings: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Hostinger sets global wait_timeout=20s by default; extend session wait_timeout to 300s on each new connection
pool.on('connection', (connection) => {
  connection.query('SET SESSION wait_timeout = 300', () => {});
});

const TRANSIENT_DB_CODES = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE'
]);

// Helper function to execute SQL queries safely with parameter sanitization and 1x transient retry
async function query(sql, params = []) {
  // Convert any JS undefined bind parameters to SQL null to prevent driver errors
  const sanitizedParams = (Array.isArray(params) ? params : []).map((p) =>
    p === undefined ? null : p
  );

  try {
    const [results] = await pool.execute(sql, sanitizedParams);
    return results;
  } catch (err) {
    if (err && TRANSIENT_DB_CODES.has(err.code)) {
      const [retryResults] = await pool.execute(sql, sanitizedParams);
      return retryResults;
    }
    throw err;
  }
}

// Startup check: runs one SELECT 1 query and logs host, port, and error code (no credentials)
async function verifyDatabaseConnection() {
  const host = dbConfig.host;
  const port = dbConfig.port;
  const database = dbConfig.database;

  try {
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log(
      `[DB Startup Check] Connected to MySQL at ${host}:${port} (database: ${database})`
    );
    return true;
  } catch (err) {
    const code = err.code || err.errno || 'UNKNOWN_DB_ERROR';
    console.error(
      `[DB Startup Check] MySQL connection failed — host=${host} port=${port} database=${database} code=${code} message="${err.message}"`
    );
    return false;
  }
}

module.exports = {
  dbConfig,
  pool,
  query,
  verifyDatabaseConnection
};
