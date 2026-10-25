const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  console.log('Connecting to Live Database:', process.env.DB_HOST, 'Database:', process.env.DB_NAME);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    multipleStatements: true,
  });

  console.log('Connected to remote MySQL successfully.');

  const sqlPath = path.join(__dirname, '..', 'smis_backup.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`Executing SQL script (${(sql.length / 1024).toFixed(1)} KB)...`);
  await connection.query(sql);

  console.log('SQL script executed successfully!');

  const [tables] = await connection.query('SHOW TABLES');
  console.log('\n--- Populated Tables in ' + process.env.DB_NAME + ' ---');
  for (const row of tables) {
    const tableName = Object.values(row)[0];
    const [[countResult]] = await connection.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
    console.log(`- ${tableName}: ${countResult.count} rows`);
  }

  await connection.end();
  console.log('\nAll done! Database is ready.');
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
