const { query, pool } = require('../config/db');

async function run() {
  console.log('=== Step 1: DDL Updates ===');
  try {
    await query("ALTER TABLE users MODIFY COLUMN status ENUM('pending', 'active', 'rejected', 'deactivated') NOT NULL DEFAULT 'pending'");
    console.log('✅ users.status enum updated to include deactivated.');
  } catch (e) {
    console.log('Note on users.status alter:', e.message);
  }

  try {
    await query("ALTER TABLE customers MODIFY COLUMN status ENUM('pending', 'active', 'rejected', 'deactivated') NOT NULL DEFAULT 'pending'");
    console.log('✅ customers.status enum updated to include deactivated.');
  } catch (e) {
    console.log('Note on customers.status alter:', e.message);
  }

  try {
    await query("ALTER TABLE pending_registrations ADD COLUMN rejection_reason TEXT NULL AFTER status");
    console.log('✅ pending_registrations.rejection_reason added.');
  } catch (e) {
    console.log('Note on pending_registrations.rejection_reason:', e.message);
  }

  console.log('\n=== Step 2: Data Cleanup (Requirement 8) ===');
  // Find accounts that are in pending queue or have pending status in users
  const pendingUsers = await query(`
    SELECT id, first_name, last_name, username, email, role, status, is_active, temp_password_plain
    FROM users
    WHERE status = 'pending' OR id IN (53, 54) OR email IN ('james.cafra@smis.local', 'jed.madi@smis.local')
  `);

  console.log(`Found ${pendingUsers.length} pending user row(s) to reset to clean pending status:`);
  console.table(pendingUsers);

  for (const u of pendingUsers) {
    // 1. Reset user in users table
    await query(`
      UPDATE users
      SET status = 'pending',
          is_active = 0,
          password_hash = NULL,
          is_temp_password = 0,
          temp_password_plain = NULL,
          updated_at = NOW()
      WHERE id = ?
    `, [u.id]);

    // 2. Reset customer status
    await query(`
      UPDATE customers
      SET status = 'pending',
          updated_at = NOW()
      WHERE user_id = ?
    `, [u.id]);

    // 3. Ensure matching record exists in pending_registrations with status = 'pending'
    const pendingRows = await query('SELECT id, status FROM pending_registrations WHERE email = ?', [u.email]);
    if (pendingRows.length > 0) {
      await query("UPDATE pending_registrations SET status = 'pending' WHERE id = ?", [pendingRows[0].id]);
      console.log(`[CLEANUP] Reset pending_registrations row id ${pendingRows[0].id} for ${u.first_name} ${u.last_name} (${u.email}) to 'pending'.`);
    } else {
      const custRows = await query('SELECT phone, address FROM customers WHERE user_id = ?', [u.id]);
      const phone = custRows[0]?.phone || null;
      const address = custRows[0]?.address || null;
      const res = await query(`
        INSERT INTO pending_registrations (first_name, middle_name, middle_initial, last_name, username, email, phone, address, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
      `, [u.first_name, u.middle_name || null, u.middle_initial || null, u.last_name, u.username, u.email, phone, address]);
      console.log(`[CLEANUP] Inserted pending_registrations record id ${res.insertId} for ${u.first_name} ${u.last_name} (${u.email}) with status 'pending'.`);
    }
  }

  // 4. Update deactivated accounts: any account with is_active = 0 and status = 'active'
  const deactivatedUsers = await query("SELECT id, first_name, last_name, email FROM users WHERE is_active = 0 AND status = 'active'");
  if (deactivatedUsers.length > 0) {
    console.log(`Updating ${deactivatedUsers.length} inactive user(s) to status = 'deactivated':`);
    console.table(deactivatedUsers);
    await query("UPDATE users SET status = 'deactivated' WHERE is_active = 0 AND status = 'active'");
    await query("UPDATE customers SET status = 'deactivated' WHERE user_id IN (SELECT id FROM users WHERE is_active = 0)");
  }

  // 5. SECURITY: Clear plaintext passwords from users table
  const clearPlainResult = await query("UPDATE users SET temp_password_plain = NULL WHERE temp_password_plain IS NOT NULL");
  console.log(`[SECURITY] Cleared plaintext passwords (temp_password_plain) for ${clearPlainResult.affectedRows || 0} user row(s).`);

  console.log('\n=== Summary of Pending Accounts Queue ===');
  const finalPending = await query("SELECT id, first_name, last_name, username, email, phone, status, created_at FROM pending_registrations WHERE status = 'pending' ORDER BY created_at DESC");
  console.table(finalPending);

  console.log('\n=== Summary of User Accounts List (status NOT IN pending, rejected) ===');
  const finalUsers = await query("SELECT id, first_name, last_name, username, email, role, status, is_active FROM users WHERE deleted_at IS NULL AND status NOT IN ('pending', 'rejected') ORDER BY id DESC");
  console.table(finalUsers);

  console.log('\n✅ Data cleanup and migration completed successfully.');
  process.exit(0);
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
