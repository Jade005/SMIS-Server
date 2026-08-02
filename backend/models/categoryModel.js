const { query } = require('../config/db');

const CategoryModel = {
  async getAll() {
    return await query('SELECT * FROM categories ORDER BY name ASC');
  },

  async getById(id) {
    const rows = await query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create({ name, description }) {
    const result = await query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    return result.insertId;
  },

  async update(id, { name, description }) {
    await query('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description, id]);
    return this.getById(id);
  },

  async delete(id) {
    await query('DELETE FROM categories WHERE id = ?', [id]);
    return true;
  }
};

module.exports = CategoryModel;
