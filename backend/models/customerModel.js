const { query } = require('../config/db');

const CustomerModel = {
  async getAll() {
    const sql = `
      SELECT c.*, u.first_name, u.last_name, u.email, u.is_active
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      ORDER BY u.first_name ASC
    `;
    return await query(sql);
  },

  async getByUserId(user_id) {
    const sql = `
      SELECT c.*, u.first_name, u.last_name, u.email, u.is_active
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.user_id = ?
    `;
    const rows = await query(sql, [user_id]);
    return rows[0] || null;
  },

  async getById(id) {
    const sql = `
      SELECT c.*, u.first_name, u.last_name, u.email, u.is_active
      FROM customers c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  }
};

module.exports = CustomerModel;
