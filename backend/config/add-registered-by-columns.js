const { query } = require('./db');

async function migrate() {
  console.log('--- Migrating database to add registered_by and created_by_admin_id columns ---');

  // 1. Add registered_by to users
  try {
    await query('ALTER TABLE users ADD COLUMN registered_by INT(10) UNSIGNED NULL DEFAULT NULL AFTER role');
    console.log('✅ Added "registered_by" to users table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "registered_by" already exists in users table.');
    } else {
      console.log('Note on users.registered_by:', e.message);
    }
  }

  // 2. Add created_by_admin_id to users
  try {
    await query('ALTER TABLE users ADD COLUMN created_by_admin_id INT(10) UNSIGNED NULL DEFAULT NULL AFTER registered_by');
    console.log('✅ Added "created_by_admin_id" to users table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "created_by_admin_id" already exists in users table.');
    } else {
      console.log('Note on users.created_by_admin_id:', e.message);
    }
  }

  // 3. Add registered_by to customers
  try {
    await query('ALTER TABLE customers ADD COLUMN registered_by INT(10) UNSIGNED NULL DEFAULT NULL AFTER status');
    console.log('✅ Added "registered_by" to customers table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "registered_by" already exists in customers table.');
    } else {
      console.log('Note on customers.registered_by:', e.message);
    }
  }

  // 4. Add created_by_admin_id to customers
  try {
    await query('ALTER TABLE customers ADD COLUMN created_by_admin_id INT(10) UNSIGNED NULL DEFAULT NULL AFTER registered_by');
    console.log('✅ Added "created_by_admin_id" to customers table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "created_by_admin_id" already exists in customers table.');
    } else {
      console.log('Note on customers.created_by_admin_id:', e.message);
    }
  }

  console.log('Migration completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
