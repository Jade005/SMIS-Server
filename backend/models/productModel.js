const { query } = require('../config/db');

const ProductModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) AS total_available_stock_kg,
             CASE
               WHEN COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) = 0 THEN 'out_of_stock'
               WHEN COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) <= p.low_stock_threshold THEN 'low_stock'
               ELSE 'in_stock'
             END AS stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.category_id) {
      sql += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }

    if (filters.meat_type) {
      sql += ' AND (p.meat_type = ? OR c.name = ?)';
      params.push(filters.meat_type, filters.meat_type);
    }

    if (filters.is_active !== undefined) {
      sql += ' AND p.is_active = ?';
      params.push(filters.is_active);
    }

    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.meat_cut LIKE ? OR p.meat_type LIKE ? OR c.name LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    sql += ' GROUP BY p.id ORDER BY p.name ASC';
    return await query(sql, params);
  },

  async getById(id) {
    const sql = `
      SELECT p.*, c.name AS category_name,
             COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) AS total_available_stock_kg,
             CASE
               WHEN COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) = 0 THEN 'out_of_stock'
               WHEN COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) <= p.low_stock_threshold THEN 'low_stock'
               ELSE 'in_stock'
             END AS stock_status
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = ?
      GROUP BY p.id
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async create({ category_id, name, meat_type, meat_cut, price_per_kg, low_stock_threshold = 15.000, description, image_url }) {
    const numThreshold = Number(low_stock_threshold) > 0 ? Number(low_stock_threshold) : 15.000;
    const result = await query(
      `INSERT INTO products (category_id, name, meat_type, meat_cut, price_per_kg, low_stock_threshold, description, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id, name, meat_type, meat_cut, price_per_kg, numThreshold, description || null, image_url || null]
    );
    return result.insertId;
  },

  async update(id, { category_id, name, meat_type, meat_cut, price_per_kg, low_stock_threshold, description, image_url }) {
    const existing = await this.getById(id);
    const numThreshold = low_stock_threshold !== undefined && Number(low_stock_threshold) > 0 ? Number(low_stock_threshold) : (existing ? existing.low_stock_threshold : 15.000);
    const finalCatId = (category_id && String(category_id).trim() !== '' && String(category_id) !== 'null')
      ? parseInt(category_id, 10)
      : (existing ? existing.category_id : 1);

    await query(
      `UPDATE products
       SET category_id = ?, name = ?, meat_type = ?, meat_cut = ?, price_per_kg = ?, low_stock_threshold = ?, description = ?, image_url = ?
       WHERE id = ?`,
      [finalCatId, name, meat_type, meat_cut, price_per_kg, numThreshold, description, image_url, id]
    );
    return this.getById(id);
  },

  async toggleStatus(id, is_active) {
    await query('UPDATE products SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return this.getById(id);
  },

  async delete(id) {
    return await query('DELETE FROM products WHERE id = ?', [id]);
  }
};

module.exports = ProductModel;
