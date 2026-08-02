const { pool, query } = require('./db');

async function testConnection() {
  try {
    console.log('Testing MySQL connection from SMIS-Server/backend...');
    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    console.log('✅ Connection successful! Test Query Result:', rows[0].solution);

    console.log('\nChecking tables in database "smis"...');
    const tables = await query('SHOW TABLES');
    console.log('✅ Existing tables in "smis":', tables.map(t => Object.values(t)[0]));

    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
