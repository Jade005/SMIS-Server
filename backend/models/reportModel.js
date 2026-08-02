const { query } = require('../config/db');

const ReportModel = {
  async getSalesReport({ period = 'daily', date = null }) {
    let sql = `
      SELECT s.id, s.receipt_no, s.subtotal, s.discount, s.total_amount, s.payment_method, s.created_at,
             CONCAT(u.first_name, ' ', u.last_name) AS cashier_name
      FROM sales s
      INNER JOIN users u ON s.cashier_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (period === 'daily') {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      sql += ' AND DATE(s.created_at) = ?';
      params.push(targetDate);
    } else if (period === 'weekly') {
      sql += ' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'monthly') {
      sql += ' AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    sql += ' ORDER BY s.created_at DESC';
    const sales = await query(sql, params);

    const summarySql = `
      SELECT COUNT(id) AS total_transactions,
             COALESCE(SUM(total_amount), 0) AS total_revenue,
             COALESCE(AVG(total_amount), 0) AS average_transaction_value
      FROM sales
      WHERE ${period === 'daily' ? 'DATE(created_at) = ?' : period === 'weekly' ? 'created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)' : 'created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'}
    `;

    const summaryParams = period === 'daily' ? [date || new Date().toISOString().slice(0, 10)] : [];
    const summary = await query(summarySql, summaryParams);

    return {
      period,
      summary: summary[0],
      transactions: sales
    };
  },

  async getInventoryReport() {
    const sql = `
      SELECT i.id, i.batch_no, p.name AS product_name, c.name AS category_name,
             s.name AS supplier_name, i.weight_kg, i.available_stock_kg,
             i.price_per_kg, i.date_processed, i.expiration_date, i.status
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN categories c ON p.category_id = c.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      ORDER BY i.expiration_date ASC
    `;
    return await query(sql);
  },

  async getExpiryReport() {
    const sql = `
      SELECT i.id, i.batch_no, p.name AS product_name, s.name AS supplier_name,
             i.available_stock_kg, i.expiration_date,
             CASE
               WHEN i.expiration_date < CURDATE() THEN 'Expired'
               WHEN i.expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY) THEN 'Expiring Soon'
               ELSE 'Valid'
             END AS expiry_flag
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY i.expiration_date ASC
    `;
    return await query(sql);
  },

  async getSupplierReport() {
    const sql = `
      SELECT s.id, s.name AS supplier_name, s.contact_person, s.phone,
             COUNT(i.id) AS total_batches_supplied,
             COALESCE(SUM(i.weight_kg), 0) AS total_weight_supplied_kg
      FROM suppliers s
      LEFT JOIN inventory i ON s.id = i.supplier_id
      GROUP BY s.id
      ORDER BY total_weight_supplied_kg DESC
    `;
    return await query(sql);
  }
};

module.exports = ReportModel;
