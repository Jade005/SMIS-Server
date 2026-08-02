const { query } = require('../config/db');

const AnalyticsModel = {
  async getRevenueTrends(days = 30) {
    const sql = `
      SELECT DATE(created_at) AS date,
             COUNT(id) AS total_sales_count,
             COALESCE(SUM(total_amount), 0) AS daily_revenue
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
    return await query(sql, [days]);
  },

  async getBestSellers(limit = 5) {
    const sql = `
      SELECT si.product_name, si.meat_cut,
             COALESCE(SUM(si.weight_kg), 0) AS total_kg_sold,
             COALESCE(SUM(si.subtotal), 0) AS total_revenue_generated
      FROM sales_items si
      GROUP BY si.product_name, si.meat_cut
      ORDER BY total_kg_sold DESC
      LIMIT ?
    `;
    return await query(sql, [limit]);
  },

  async getSalesByCategory() {
    const sql = `
      SELECT c.name AS category_name,
             COALESCE(SUM(si.weight_kg), 0) AS total_kg_sold,
             COALESCE(SUM(si.subtotal), 0) AS total_revenue
      FROM sales_items si
      INNER JOIN products p ON si.product_id = p.id
      INNER JOIN categories c ON p.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC
    `;
    return await query(sql);
  }
};

module.exports = AnalyticsModel;
