const { query } = require('../config/db');

const ProductModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(i.available_stock_kg), 0) AS total_available_stock_kg
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND i.status IN ('available', 'low')
      WHERE 1=1
    `;
    const params = [];

    if (filters.category_id) {
      sql += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.meat_type) {
      sql += ' AND p.meat_type = ?';
      params.push(filters.meat_type);
    }

    if (filters.is_active !== undefined) {
      sql += ' AND p.is_active = ?';
      params.push(filters.is_active);
    }

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.meat_cut LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    sql += ' GROUP BY p.id ORDER BY p.name ASC';
    return await query(sql, params);
  },

  async getById(id) {
    const sql = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(i.available_stock_kg), 0) AS total_available_stock_kg
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id AND i.status IN ('available', 'low')
      WHERE p.id = ?
      GROUP BY p.id
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async create({ category_id, name, meat_type, meat_cut, price_per_kg, description, image_url }) {
    const result = await query(
      `INSERT INTO products (category_id, name, meat_type, meat_cut, price_per_kg, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [category_id, name, meat_type, meat_cut, price_per_kg, description || null, image_url || null]
    );
    return result.insertId;
  },

  async update(id, { category_id, name, meat_type, meat_cut, price_per_kg, description, image_url }) {
    await query(
      `UPDATE products
       SET category_id = ?, name = ?, meat_type = ?, meat_cut = ?, price_per_kg = ?, description = ?, image_url = ?
       WHERE id = ?`,
      [category_id, name, meat_type, meat_cut, price_per_kg, description, image_url, id]
    );
    return this.getById(id);
  },

  async toggleStatus(id, is_active) {
    await query('UPDATE products SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return this.getById(id);
  }
};

module.exports = ProductModel;
