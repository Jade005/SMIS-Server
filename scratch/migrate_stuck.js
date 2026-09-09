const { query } = require('../backend/config/db');

async function migrateStuckUsers() {
  try {
    const stuckUsers = await query("SELECT u.*, c.phone, c.address FROM users u LEFT JOIN customers c ON c.user_id = u.id WHERE u.is_active = 0 AND u.role = 'customer'");
    console.log(`Found ${stuckUsers.length} stuck users.`);

    for (const u of stuckUsers) {
      await query(
        'INSERT INTO pending_registrations (first_name, last_name, username, email, phone, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [u.first_name, u.last_name, u.username, u.email, u.phone, u.address, 'pending', u.created_at]
      );
      // Delete from users so they don't block the email uniqueness check
      await query('DELETE FROM users WHERE id = ?', [u.id]);
      await query('DELETE FROM customers WHERE user_id = ?', [u.id]);
      console.log(`Migrated ${u.email}`);
    }
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

migrateStuckUsers();
