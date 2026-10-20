const { query } = require('../config/db');

async function fixSuppliers() {
  console.log('--- Cleaning up duplicate suppliers #3 and #4 ---');
  
  // 1. Reassign any inventory batches from supplier 3 or 4 to supplier 1
  const updateResult = await query('UPDATE inventory SET supplier_id = 1 WHERE supplier_id IN (3, 4)');
  console.log('Reassigned inventory batches to supplier #1. Affected rows:', updateResult.affectedRows);

  // 2. Remove duplicate suppliers #3 and #4
  const deleteResult = await query('DELETE FROM suppliers WHERE id IN (3, 4)');
  console.log('Deleted duplicate suppliers #3 and #4. Affected rows:', deleteResult.affectedRows);

  // 3. Verify remaining suppliers
  const remaining = await query('SELECT id, name, contact_person, phone, email FROM suppliers');
  console.log('Remaining suppliers in DB:', remaining);

  process.exit(0);
}

fixSuppliers().catch(err => {
  console.error('Failed to fix suppliers:', err);
  process.exit(1);
});
