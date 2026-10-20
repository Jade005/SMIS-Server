const { query } = require('../config/db');

async function run() {
  const suppliers = await query('SELECT * FROM suppliers');
  console.log('Suppliers:', suppliers);

  const invRefs = await query('SELECT id, batch_no, supplier_id FROM inventory WHERE supplier_id IN (3, 4)');
  console.log('Inventory referencing 3 or 4:', invRefs);

  const fkTables = await query(`
    SELECT TABLE_NAME, COLUMN_NAME 
    FROM information_schema.KEY_COLUMN_USAGE 
    WHERE REFERENCED_TABLE_NAME = 'suppliers' AND TABLE_SCHEMA = 'smis'
  `);
  console.log('Foreign keys pointing to suppliers:', fkTables);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
