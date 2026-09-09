const { query } = require('../backend/config/db');

async function run() {
  try {
    const users = await query("SELECT * FROM users");
    console.log('USERS:', users);
    const regs = await query("SELECT * FROM pending_registrations");
    console.log('REGS:', regs);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
