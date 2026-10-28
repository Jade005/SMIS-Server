const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'smis',
  password: process.env.DB_PASSWORD || 'smis',
  database: process.env.DB_NAME || 'smis',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  dateStrings: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Helper function to execute SQL queries safely with parameter sanitization
async function query(sql, params = []) {
  // Convert any JS undefined bind parameters to SQL null to prevent driver errors
  const sanitizedParams = (Array.isArray(params) ? params : []).map((p) =>
    p === undefined ? null : p
  );
  const [results] = await pool.execute(sql, sanitizedParams);
  return results;
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
  pool,
  query,
  verifyDatabaseConnection
};
