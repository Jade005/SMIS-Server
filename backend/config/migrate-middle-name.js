const { pool, query } = require('./db');

async function migrateMiddleName() {
  console.log('--- Migrating database to add middle_name and middle_initial columns ---');

  // 1. Add middle_name & middle_initial to users table
  try {
    await query('ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name');
    console.log('✅ Added "middle_name" column to users table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_name" already exists in users table.');
    } else {
      console.log('Note on users.middle_name:', e.message);
    }
  }

  try {
    await query('ALTER TABLE users ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    console.log('✅ Added "middle_initial" column to users table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_initial" already exists in users table.');
    } else {
      console.log('Note on users.middle_initial:', e.message);
    }
  }

  // 2. Add middle_name & middle_initial to customers table
  try {
    await query('ALTER TABLE customers ADD COLUMN middle_name VARCHAR(100) NULL AFTER user_id');
    console.log('✅ Added "middle_name" column to customers table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_name" already exists in customers table.');
    } else {
      console.log('Note on customers.middle_name:', e.message);
    }
  }

  try {
    await query('ALTER TABLE customers ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    console.log('✅ Added "middle_initial" column to customers table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_initial" already exists in customers table.');
    } else {
      console.log('Note on customers.middle_initial:', e.message);
    }
  }

  // 3. Add middle_name & middle_initial to pending_registrations table
  try {
    await query('ALTER TABLE pending_registrations ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name');
    console.log('✅ Added "middle_name" column to pending_registrations table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_name" already exists in pending_registrations table.');
    } else {
      console.log('Note on pending_registrations.middle_name:', e.message);
    }
  }

  try {
    await query('ALTER TABLE pending_registrations ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    console.log('✅ Added "middle_initial" column to pending_registrations table.');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️ "middle_initial" already exists in pending_registrations table.');
    } else {
      console.log('Note on pending_registrations.middle_initial:', e.message);
    }
  }

  console.log('🎉 Middle name columns migration completed successfully.');
  process.exit(0);
}

migrateMiddleName().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
