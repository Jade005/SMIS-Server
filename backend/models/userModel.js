const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

const UserModel = {
  async findByEmail(email) {
    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    return users[0] || null;
  },

  async findById(id) {
    const users = await query(
      'SELECT id, first_name, last_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return users[0] || null;
  },

  async getAllUsers(filters = {}) {
    let sql = 'SELECT id, first_name, last_name, email, role, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      sql += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    sql += ' ORDER BY created_at DESC';
    return await query(sql, params);
  },

  async createUser({ first_name, last_name, email, password, role = 'customer', is_active }) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Customers start inactive (pending admin approval); other roles start active
    const active = is_active !== undefined ? (is_active ? 1 : 0) : (role === 'customer' ? 0 : 1);

    const result = await query(
      'INSERT INTO users (first_name, last_name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [first_name, last_name, email, password_hash, role, active]
    );

    return result.insertId;
  },

  async updateUser(id, { first_name, last_name, email, role }) {
    await query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, role = ? WHERE id = ?',
      [first_name, last_name, email, role, id]
    );
    return this.findById(id);
  },

  async updatePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, id]);
    return true;
  },

  async toggleStatus(id, is_active) {
    await query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return this.findById(id);
  },

  async getPendingUsers() {
    return await query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.is_active, u.created_at,
              c.phone, c.address
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.role = 'customer' AND u.is_active = 0
       ORDER BY u.created_at DESC`
    );
  },

  async approveUser(id) {
    await query('UPDATE users SET is_active = 1 WHERE id = ? AND role = \'customer\'', [id]);
    return this.findById(id);
  },

  async comparePassword(candidatePassword, passwordHash) {
    return await bcrypt.compare(candidatePassword, passwordHash);
  }
};

module.exports = UserModel;
