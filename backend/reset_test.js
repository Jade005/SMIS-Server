// Reset ejay back to pending for UI re-testing
require('dotenv').config({ path: './.env' });
const { query } = require('./config/db');

async function reset() {
  // Reset ejay's registration back to pending for UI testing
  await query("UPDATE pending_registrations SET status = 'pending' WHERE id = 1");
  
  // Delete the user created by the diagnostic (ID 39)
  await query('DELETE FROM customers WHERE user_id = 39');
  await query('DELETE FROM users WHERE id = 39');
  
  const regs = await query('SELECT * FROM pending_registrations');
  const users = await query("SELECT id, first_name, email FROM users WHERE email LIKE 'ejay%'");
  console.log('Registrations:', JSON.stringify(regs));
  console.log('Ejay in users:', JSON.stringify(users));
  console.log('\nReset complete! ejay is pending again and user/customer record removed.');
  process.exit(0);
}

reset().catch(e => { console.error(e.message); process.exit(1); });
