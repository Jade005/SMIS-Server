const { pool, query } = require('./db');

async function runMigration() {
  try {
    console.log('Running database schema updates...');

    // 1. Add username column to users if missing
    try {
      await query('ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL AFTER email');
      console.log('✅ Added "username" column to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "username" column already exists in users table.');
      } else {
        console.log('Note on username column:', e.message);
      }
    }

    // 2. Add unique index on username
    try {
      await query('ALTER TABLE users ADD UNIQUE INDEX uq_users_username (username)');
      console.log('✅ Added unique index uq_users_username.');
    } catch (e) {
      // index may already exist
    }

    // 3. Add is_temp_password column to users if missing
    try {
      await query('ALTER TABLE users ADD COLUMN is_temp_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active');
      console.log('✅ Added "is_temp_password" column to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "is_temp_password" column already exists in users table.');
      } else {
        console.log('Note on is_temp_password column:', e.message);
      }
    }

    // 4. Add profile_picture column to users table if missing
    try {
      await query('ALTER TABLE users ADD COLUMN profile_picture LONGTEXT NULL AFTER is_temp_password');
      console.log('✅ Added "profile_picture" column to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "profile_picture" column already exists in users table.');
      } else {
        console.log('Note on profile_picture column:', e.message);
      }
    }

    // 5. Add profile_image column to customers table if missing
    try {
      await query('ALTER TABLE customers ADD COLUMN profile_image LONGTEXT NULL');
      console.log('✅ Added "profile_image" column to customers table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "profile_image" column already exists in customers table.');
      } else {
        console.log('Note on profile_image column:', e.message);
      }
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
