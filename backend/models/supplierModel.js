const { query } = require('../config/db');

const SupplierModel = {
  async getAll(filters = {}) {
    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    const params = [];

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    if (filters.search) {
      sql += ' AND (name LIKE ? OR contact_person LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' ORDER BY name ASC';
    return await query(sql, params);
  },

  async getById(id) {
    const rows = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ name, contact_person, phone, email, address }) {
    const result = await query(
      'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)',
      [name, contact_person || null, phone || null, email || null, address || null]
    );
    return result.insertId;
  },

  async update(id, { name, contact_person, phone, email, address }) {
    await query(
      'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ? WHERE id = ?',
      [name, contact_person, phone, email, address, id]
    );
    return this.getById(id);
  },

  async toggleStatus(id, is_active) {
    await query('UPDATE suppliers SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return this.getById(id);
  }
};

module.exports = SupplierModel;
