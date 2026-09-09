const { query } = require('../backend/config/db');

async function createTable() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS pending_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY, 
      first_name VARCHAR(100), 
      last_name VARCHAR(100), 
      username VARCHAR(100), 
      email VARCHAR(255) UNIQUE, 
      phone VARCHAR(30), 
      address TEXT, 
      status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending', 
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('Table created');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

createTable();
