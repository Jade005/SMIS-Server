const { query } = require('../config/db');

const ReportModel = {
  async getSalesReport({ period = 'daily', date = null }) {
    let dateSql = '';
    const dateParams = [];

    if (period === 'daily') {
      if (date) {
        dateSql = 'AND DATE(s.created_at) = ?';
        dateParams.push(date);
      } else {
        // Use MySQL CURDATE() to avoid JS UTC/local timezone mismatch
        dateSql = 'AND DATE(s.created_at) = CURDATE()';
      }
    } else if (period === 'weekly') {
      dateSql = 'AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'monthly') {
      dateSql = 'AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const salesSql = `
      SELECT s.id, s.receipt_no, s.subtotal, s.discount, s.total_amount, s.payment_method, s.created_at,
             CONCAT(u.first_name, ' ', u.last_name) AS cashier_name
      FROM sales s
      INNER JOIN users u ON s.cashier_id = u.id
      WHERE 1=1 ${dateSql}
      ORDER BY s.created_at DESC
    `;
    const sales = await query(salesSql, dateParams);

    const summarySql = `
      SELECT COUNT(id) AS total_transactions,
             COALESCE(SUM(total_amount), 0) AS total_revenue,
             COALESCE(AVG(total_amount), 0) AS average_transaction_value
      FROM sales s
      WHERE 1=1 ${dateSql}
    `;
    const summary = await query(summarySql, dateParams);

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
