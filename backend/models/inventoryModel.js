const { query } = require('../config/db');
const { generateBatchNo } = require('../utils/receiptGenerator');

const InventoryModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT i.*, p.name AS product_name, p.meat_type, p.meat_cut, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND i.status = ?';
      params.push(filters.status);
    }

    if (filters.product_id) {
      sql += ' AND i.product_id = ?';
      params.push(filters.product_id);
    }

    if (filters.supplier_id) {
      sql += ' AND i.supplier_id = ?';
      params.push(filters.supplier_id);
    }

    sql += ' ORDER BY i.created_at DESC';
    return await query(sql, params);
  },

  async getById(id) {
    const sql = `
      SELECT i.*, p.name AS product_name, p.meat_type, p.meat_cut, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async addBatch({ product_id, supplier_id, weight_kg, price_per_kg, date_processed, expiration_date, notes }) {
    const batch_no = generateBatchNo();
    const available_stock_kg = weight_kg;
    const status = 'available';

    const result = await query(
      `INSERT INTO inventory
       (product_id, supplier_id, batch_no, weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, supplier_id, batch_no, weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status, notes || null]
    );

    return result.insertId;
  },

  async updateBatch(id, { weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status, notes }) {
    await query(
      `UPDATE inventory
       SET weight_kg = ?, available_stock_kg = ?, price_per_kg = ?, date_processed = ?, expiration_date = ?, status = ?, notes = ?
       WHERE id = ?`,
      [weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status, notes, id]
    );
    return this.getById(id);
  },

  async updateStatus(id, status) {
    await query('UPDATE inventory SET status = ? WHERE id = ?', [status, id]);
    return this.getById(id);
  },

  async getLowStockAlerts(thresholdKg = 10) {
    const sql = `
      SELECT i.*, p.name AS product_name, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.available_stock_kg <= ? AND i.status IN ('available', 'low')
      ORDER BY i.available_stock_kg ASC
    `;
    return await query(sql, [thresholdKg]);
  },

  async getExpiringAlerts(daysAhead = 3) {
    const sql = `
      SELECT i.*, p.name AS product_name, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND i.status IN ('available', 'low')
      ORDER BY i.expiration_date ASC
    `;
    return await query(sql, [daysAhead]);
  },

  async getExpiredAlerts() {
    const sql = `
      SELECT i.*, p.name AS product_name, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.expiration_date < CURDATE() OR i.status = 'expired'
      ORDER BY i.expiration_date DESC
    `;
    return await query(sql, []);
  }
};

module.exports = InventoryModel;
