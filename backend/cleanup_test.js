require('dotenv').config({ path: './.env' });
const { query } = require('./config/db');

async function cleanup() {
  // Find user IDs for ejay
  const ejayUsers = await query("SELECT id FROM users WHERE email = 'ejay.madijanon@smis.local'");
  for (const u of ejayUsers) {
    await query('DELETE FROM customers WHERE user_id = ?', [u.id]);
    await query('DELETE FROM users WHERE id = ?', [u.id]);
  }
  await query("UPDATE pending_registrations SET status = 'pending' WHERE email = 'ejay.madijanon@smis.local'");
  
  const regs = await query('SELECT * FROM pending_registrations');
  console.log('After cleanup - registrations:', JSON.stringify(regs));
  console.log('Database reset. Ready for live UI testing!');
  process.exit(0);
}

cleanup().catch(e => { console.error(e.message); process.exit(1); });
