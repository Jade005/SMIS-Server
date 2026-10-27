const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

let schemaEnsured = false;

async function ensureColumns() {
  if (schemaEnsured) return;
  try {
    // Add columns to users if missing
    try {
      await query('ALTER TABLE users ADD COLUMN username VARCHAR(100) NULL');
    } catch (e) {
      // Column may already exist
    }

    try {
      await query('ALTER TABLE users ADD COLUMN is_temp_password TINYINT(1) NOT NULL DEFAULT 0');
    } catch (e) {
      // Column may already exist
    }

    try {
      await query('ALTER TABLE users ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name');
    } catch (e) {}

    try {
      await query('ALTER TABLE users ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    } catch (e) {}

    // Add columns to customers if missing
    try {
      await query('ALTER TABLE customers ADD COLUMN middle_name VARCHAR(100) NULL AFTER user_id');
    } catch (e) {}

    try {
      await query('ALTER TABLE customers ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    } catch (e) {}

    try {
      await query('ALTER TABLE customers ADD COLUMN profile_image LONGTEXT NULL');
    } catch (e) {
      // Column may already exist
    }
    try {
      await query('ALTER TABLE customers ADD COLUMN contact_number VARCHAR(30) NULL');
    } catch (e) {
      // Column may already exist
    }
    try {
      await query('ALTER TABLE customers ADD COLUMN username VARCHAR(100) NULL');
    } catch (e) {
      // Column may already exist
    }

    // Add columns to pending_registrations if missing
    try {
      await query('ALTER TABLE pending_registrations ADD COLUMN middle_name VARCHAR(100) NULL AFTER first_name');
    } catch (e) {}
    try {
      await query('ALTER TABLE pending_registrations ADD COLUMN middle_initial VARCHAR(10) NULL AFTER middle_name');
    } catch (e) {}

    schemaEnsured = true;
  } catch (err) {
    console.error('Schema update error in customerModel:', err);
  }
}

const CustomerModel = {
  async ensureSchema() {
    await ensureColumns();
  },

  async getAll() {
    await ensureColumns();
    const sql = `
      SELECT c.*, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.email, u.is_active, u.is_temp_password,
             COALESCE(c.username, u.username) AS username,
             COALESCE(c.contact_number, c.phone) AS contact_number
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      ORDER BY u.first_name ASC
    `;
    return await query(sql);
  },

  async getByUserId(user_id) {
    await ensureColumns();
    const sql = `
      SELECT 
        u.id AS user_id,
        u.first_name,
        u.middle_name,
        u.middle_initial,
        u.last_name,
        u.email,
        u.role,
        u.is_active,
        u.is_temp_password,
        COALESCE(u.username, c.username) AS username,
        c.id AS customer_id,
        c.profile_image,
        COALESCE(c.contact_number, c.phone) AS contact_number,
        c.phone,
        c.address
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.id = ?
    `;
    const rows = await query(sql, [user_id]);
    return rows[0] || null;
  },

  async getById(id) {
    await ensureColumns();
    const sql = `
      SELECT c.*, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.email, u.is_active, u.is_temp_password,
             COALESCE(c.username, u.username) AS username,
             COALESCE(c.contact_number, c.phone) AS contact_number
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async findByUsername(username, excludeUserId = null) {
    await ensureColumns();
    let sql = `
      SELECT u.id FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE (u.username = ? OR c.username = ?)
    `;
    const params = [username, username];
    if (excludeUserId) {
      sql += ' AND u.id != ?';
      params.push(excludeUserId);
    }
    const rows = await query(sql, params);
    return rows[0] || null;
  },

  async findByEmail(email, excludeUserId = null) {
    await ensureColumns();
    let sql = 'SELECT id FROM users WHERE email = ?';
    const params = [email];
    if (excludeUserId) {
      sql += ' AND id != ?';
      params.push(excludeUserId);
    }
    const rows = await query(sql, params);
    return rows[0] || null;
  },

  async updateProfile(user_id, { first_name, middle_name, middle_initial, last_name, username, email, contact_number, profile_image }) {
    await ensureColumns();

    // 1. Update users table
    const userUpdates = ['first_name = ?', 'last_name = ?', 'email = ?', 'username = ?'];
    const userParams = [first_name, last_name, email, username || null];
    if (middle_name !== undefined) {
      userUpdates.push('middle_name = ?', 'middle_initial = ?');
      userParams.push(middle_name || null, middle_initial || null);
    }
    userParams.push(user_id);
    await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userParams);

    // 2. Check if customer record exists
    const existingCust = await query('SELECT id FROM customers WHERE user_id = ?', [user_id]);
    
    if (existingCust.length > 0) {
      const custUpdates = ['contact_number = ?', 'phone = ?', 'profile_image = ?', 'username = ?'];
      const custParams = [contact_number || null, contact_number || null, profile_image || null, username || null];
      if (middle_name !== undefined) {
        custUpdates.push('middle_name = ?', 'middle_initial = ?');
        custParams.push(middle_name || null, middle_initial || null);
      }
      custParams.push(user_id);
      await query(`UPDATE customers SET ${custUpdates.join(', ')} WHERE user_id = ?`, custParams);
    } else {
      await query(
        'INSERT INTO customers (user_id, middle_name, middle_initial, contact_number, phone, profile_image, username) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [user_id, middle_name || null, middle_initial || null, contact_number || null, contact_number || null, profile_image || null, username || null]
      );
    }

    return await this.getByUserId(user_id);
  },

  async updatePasswordHash(user_id, password_hash) {
    await query('UPDATE users SET password_hash = ?, is_temp_password = 0, temp_password_plain = NULL WHERE id = ?', [password_hash, user_id]);
    return true;
  }
};

module.exports = CustomerModel;
