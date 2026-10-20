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

    // 6. Add temp_password_plain column to users table if missing
    try {
      await query('ALTER TABLE users ADD COLUMN temp_password_plain VARCHAR(255) NULL AFTER is_temp_password');
      console.log('✅ Added "temp_password_plain" column to users table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "temp_password_plain" column already exists in users table.');
      } else {
        console.log('Note on temp_password_plain column:', e.message);
      }
    }

    // Backfill plain temp password for existing active temp password users
    await query(`
      UPDATE users 
      SET temp_password_plain = CONCAT(LOWER(REPLACE(first_name, ' ', '')), LOWER(REPLACE(last_name, ' ', '')), '123')
      WHERE is_temp_password = 1 AND (temp_password_plain IS NULL OR temp_password_plain = '')
    `);
    console.log('✅ Backfilled temp_password_plain for active temp password users.');

    // 7. Add 'disposed' to inventory status enum
    try {
      await query("ALTER TABLE inventory MODIFY COLUMN status ENUM('available','low','expired','depleted','disposed') NOT NULL DEFAULT 'available'");
      console.log('✅ Updated inventory status enum to include "disposed".');
    } catch (e) {
      console.log('Note on inventory status enum:', e.message);
    }

    // 8. Add low_stock_threshold column to products table if missing
    try {
      await query('ALTER TABLE products ADD COLUMN low_stock_threshold DECIMAL(10,3) NOT NULL DEFAULT 15.000 AFTER price_per_kg');
      console.log('✅ Added "low_stock_threshold" column to products table.');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ "low_stock_threshold" column already exists in products table.');
      } else {
        console.log('Note on low_stock_threshold column:', e.message);
      }
    }

    // 9. Create inventory_disposals table if missing
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS inventory_disposals (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          inventory_id INT UNSIGNED NOT NULL,
          batch_no VARCHAR(50) NOT NULL,
          product_id INT UNSIGNED NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          meat_cut VARCHAR(100) NULL,
          weight_disposed_kg DECIMAL(10,3) NOT NULL,
          disposed_by INT UNSIGNED NULL,
          disposed_by_name VARCHAR(255) NULL,
          reason VARCHAR(255) DEFAULT 'Expired stock disposal',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_inventory_id (inventory_id),
          INDEX idx_product_id (product_id),
          INDEX idx_created_at (created_at)
        )
      `);
      console.log('✅ Created or verified "inventory_disposals" table.');
    } catch (e) {
      console.log('Note on inventory_disposals table:', e.message);
    }

    // 10. Mark all expired batches appropriately
    try {
      await query(`
        UPDATE inventory
        SET status = 'expired'
        WHERE expiration_date < CURDATE() AND status NOT IN ('depleted', 'disposed', 'expired')
      `);
      console.log('✅ Synchronized expired batch statuses with current date.');
    } catch (e) {
      console.log('Note on expired batch sync:', e.message);
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
