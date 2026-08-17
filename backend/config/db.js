const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'smis',
  password: process.env.DB_PASSWORD || 'smis',
  database: process.env.DB_NAME || 'smis',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Helper function to execute SQL queries safely with parameter sanitization
async function query(sql, params = []) {
  // Convert any JS undefined bind parameters to SQL null to prevent driver errors
  const sanitizedParams = (Array.isArray(params) ? params : []).map((p) =>
    p === undefined ? null : p
  );
  const [results] = await pool.execute(sql, sanitizedParams);
  return results;
}

module.exports = {
  pool,
  query
};
