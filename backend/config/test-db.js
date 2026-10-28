const { dbConfig, pool, query, verifyDatabaseConnection } = require('./db');

async function testConnection() {
  try {
    console.log(
      `Testing MySQL connection from SMIS-Server/backend to ${dbConfig.host}:${dbConfig.port} (${dbConfig.database})...`
    );
    const ok = await verifyDatabaseConnection();
    if (!ok) {
      process.exit(1);
    }

    const [rows] = await pool.query('SELECT 1 + 1 AS solution');
    console.log('✅ Connection successful! Test Query Result:', rows[0].solution);

    console.log(`\nChecking tables in database "${dbConfig.database}"...`);
    const tables = await query('SHOW TABLES');
    console.log(
      `✅ Existing tables in "${dbConfig.database}" (${tables.length}):`,
      tables.map((t) => Object.values(t)[0])
    );

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error(error.message);
    process.exit(1);
  }
}

testConnection();
