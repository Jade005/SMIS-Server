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

  async getSalesByCategory(period = null) {
    let dateSql = '';
    if (period === 'daily') {
      dateSql = 'AND DATE(s.created_at) = CURDATE()';
    } else if (period === 'weekly') {
      dateSql = 'AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
    } else if (period === 'monthly') {
      dateSql = 'AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    }

    const sql = `
      SELECT c.name AS category_name,
             COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.weight_kg ELSE 0 END), 0) AS total_kg_sold,
             COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.subtotal ELSE 0 END), 0) AS total_revenue
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      LEFT JOIN sales_items si ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id ${dateSql}
      WHERE c.name != 'Others' OR EXISTS (
        SELECT 1 FROM sales_items si2
        INNER JOIN products p2 ON si2.product_id = p2.id
        WHERE p2.category_id = c.id
      )
      GROUP BY c.id, c.name
      ORDER BY total_revenue DESC, c.id ASC
    `;
    return await query(sql);
  }
};

module.exports = AnalyticsModel;
