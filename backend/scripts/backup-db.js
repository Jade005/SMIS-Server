const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function backup() {
  const conn = await pool.getConnection();
  try {
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    let dump = '-- Database Backup for SMIS\n-- Generated: ' + new Date().toISOString() + '\n\n';
    dump += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

    for (const t of tables) {
      const tableName = t[tableKey];
      const [[createTable]] = await conn.query('SHOW CREATE TABLE `' + tableName + '`');
      dump += 'DROP TABLE IF EXISTS `' + tableName + '`;\n';
      dump += createTable['Create Table'] + ';\n\n';

      const [rows] = await conn.query('SELECT * FROM `' + tableName + '`');
      if (rows.length > 0) {
        for (const row of rows) {
          const cols = Object.keys(row).map(c => '`' + c + '`').join(', ');
          const vals = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return v;
            return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r') + "'";
          }).join(', ');
          dump += 'INSERT INTO `' + tableName + '` (' + cols + ') VALUES (' + vals + ');\n';
        }
        dump += '\n';
      }
    }
    dump += 'SET FOREIGN_KEY_CHECKS = 1;\n';
    const filename = path.join(__dirname, '..', 'backup_smis_pre_fix.sql');
    fs.writeFileSync(filename, dump, 'utf8');
    console.log('SUCCESS: Backup created at ' + filename + ' with ' + tables.length + ' tables.');
  } finally {
    conn.release();
    process.exit(0);
  }
}

backup().catch(err => {
  console.error('BACKUP FAILED:', err);
  process.exit(1);
});
