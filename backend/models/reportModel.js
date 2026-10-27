const { query } = require('../config/db');
const { resolveDateRange, generateContinuousBuckets } = require('../utils/reportDateHelper');

function getDateFormatString(granularity) {
  if (granularity === 'yearly') return "'%Y-%m'";
  return "'%Y-%m-%d'";
}

const ReportModel = {
  /**
   * 1. SALES REPORT
   * Single bar graph: Sales over time, Revenue (₱) / Volume (kg)
   * 3 KPI cards
   * Top Selling Meat Cuts Table
   * Sales Receipts Table
   */
  async getSalesReport({ granularity = 'daily', from, to }) {
    const range = resolveDateRange({ granularity, from, to });
    const fmt = getDateFormatString(range.granularity);

    // 1. Chart time-series: calculate revenue & count from sales, volume from sales_items
    const salesChartSql = `
      SELECT DATE_FORMAT(s.created_at, ${fmt}) AS bucket_key,
             COALESCE(SUM(s.total_amount), 0) AS revenue,
             COUNT(s.id) AS transactions_count
      FROM sales s
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      GROUP BY bucket_key
    `;
    const salesChartRows = await query(salesChartSql, [range.from, range.to]);

    const volumeChartSql = `
      SELECT DATE_FORMAT(si.created_at, ${fmt}) AS bucket_key,
             COALESCE(SUM(si.weight_kg), 0) AS volume_kg
      FROM sales_items si
      WHERE DATE(si.created_at) BETWEEN ? AND ?
      GROUP BY bucket_key
    `;
    const volumeChartRows = await query(volumeChartSql, [range.from, range.to]);

    const chartMap = {};
    for (const row of salesChartRows) {
      chartMap[row.bucket_key] = {
        revenue: Number(row.revenue) || 0,
        volume_kg: 0,
        transactions_count: Number(row.transactions_count) || 0
      };
    }
    for (const row of volumeChartRows) {
      if (!chartMap[row.bucket_key]) {
        chartMap[row.bucket_key] = { revenue: 0, volume_kg: 0, transactions_count: 0 };
      }
      chartMap[row.bucket_key].volume_kg = Number(row.volume_kg) || 0;
    }

    // Continuous bucket filling with 0
    const buckets = generateContinuousBuckets(range.from, range.to, range.granularity);
    const chartData = buckets.map((b) => {
      const match = chartMap[b.key] || { revenue: 0, volume_kg: 0, transactions_count: 0 };
      return {
        key: b.key,
        label: b.label,
        revenue: match.revenue,
        volume_kg: match.volume_kg,
        transactions_count: match.transactions_count
      };
    });

    // 2. Summary KPIs: query sales directly for transactions and revenue, and sales_items for volume
    const summarySalesSql = `
      SELECT COUNT(s.id) AS total_transactions,
             COALESCE(SUM(s.total_amount), 0) AS total_revenue,
             COALESCE(AVG(s.total_amount), 0) AS average_transaction_value
      FROM sales s
      WHERE DATE(s.created_at) BETWEEN ? AND ?
    `;
    const summarySalesRows = await query(summarySalesSql, [range.from, range.to]);

    const summaryVolumeSql = `
      SELECT COALESCE(SUM(si.weight_kg), 0) AS total_volume_kg
      FROM sales_items si
      WHERE DATE(si.created_at) BETWEEN ? AND ?
    `;
    const summaryVolumeRows = await query(summaryVolumeSql, [range.from, range.to]);

    const summary = {
      total_transactions: summarySalesRows[0]?.total_transactions || 0,
      total_revenue: summarySalesRows[0]?.total_revenue || 0,
      average_transaction_value: summarySalesRows[0]?.average_transaction_value || 0,
      total_volume_kg: summaryVolumeRows[0]?.total_volume_kg || 0
    };

    // 3. Top Selling Meat Cuts: aggregate directly from sales_items
    const topCutsSql = `
      SELECT si.product_name, si.meat_cut,
             COALESCE(SUM(si.weight_kg), 0) AS volume_sold,
             COALESCE(SUM(si.subtotal), 0) AS revenue,
             COALESCE(SUM(si.weight_kg), 0) AS total_kg_sold,
             COALESCE(SUM(si.subtotal), 0) AS total_revenue_generated
      FROM sales_items si
      WHERE DATE(si.created_at) BETWEEN ? AND ?
      GROUP BY si.product_name, si.meat_cut
      ORDER BY revenue DESC
      LIMIT 6
    `;
    const topSellingCuts = await query(topCutsSql, [range.from, range.to]);

    // 4. Sales Transactions
    const transactionsSql = `
      SELECT s.id, s.receipt_no, s.subtotal, s.discount, s.total_amount, s.payment_method, s.created_at,
             CONCAT(u.first_name, ' ', u.last_name) AS cashier_name
      FROM sales s
      INNER JOIN users u ON s.cashier_id = u.id
      WHERE DATE(s.created_at) BETWEEN ? AND ?
      ORDER BY s.created_at DESC
    `;
    const transactions = await query(transactionsSql, [range.from, range.to]);

    return {
      granularity: range.granularity,
      from: range.from,
      to: range.to,
      summary,
      chartData,
      topSellingCuts,
      transactions
    };
  },

  /**
   * 2. INVENTORY REPORT
   * Single bar graph: Stock received (kg) over time
   * Inventory status table
   * Filtering on batch received/delivery date (COALESCE(date_processed, DATE(created_at)))
   */
  async getInventoryReport({ granularity = 'daily', from, to }) {
    const range = resolveDateRange({ granularity, from, to });
    const fmt = getDateFormatString(range.granularity);

    // 1. Chart series: stock received (kg) over time
    const chartSql = `
      SELECT DATE_FORMAT(COALESCE(i.date_processed, DATE(i.created_at)), ${fmt}) AS bucket_key,
             COALESCE(SUM(i.weight_kg), 0) AS received_kg,
             COUNT(i.id) AS batches_count
      FROM inventory i
      WHERE COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
      GROUP BY bucket_key
    `;
    const chartRows = await query(chartSql, [range.from, range.to]);
    const chartMap = {};
    for (const r of chartRows) {
      chartMap[r.bucket_key] = {
        received_kg: Number(r.received_kg) || 0,
        batches_count: Number(r.batches_count) || 0
      };
    }

    const buckets = generateContinuousBuckets(range.from, range.to, range.granularity);
    const chartData = buckets.map((b) => {
      const match = chartMap[b.key] || { received_kg: 0, batches_count: 0 };
      return {
        key: b.key,
        label: b.label,
        received_kg: match.received_kg,
        batches_count: match.batches_count
      };
    });

    // 2. Inventory Status Table (batches received in range)
    const tableSql = `
      SELECT i.id, i.batch_no, p.name AS product_name, c.name AS category_name,
             s.name AS supplier_name, i.weight_kg, i.available_stock_kg,
             i.price_per_kg, COALESCE(i.date_processed, DATE(i.created_at)) AS date_processed,
             i.expiration_date,
             CASE
               WHEN i.available_stock_kg <= 0 THEN 'depleted'
               WHEN i.available_stock_kg <= 5 THEN 'low'
               ELSE 'available'
             END AS status
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN categories c ON p.category_id = c.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
      ORDER BY i.expiration_date ASC
    `;
    const batches = await query(tableSql, [range.from, range.to]);

    // 3. Summary metrics
    const summarySql = `
      SELECT COUNT(i.id) AS total_batches,
             COALESCE(SUM(i.weight_kg), 0) AS total_received_kg,
             COALESCE(SUM(i.available_stock_kg), 0) AS total_available_kg
      FROM inventory i
      WHERE COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
    `;
    const summaryRows = await query(summarySql, [range.from, range.to]);

    return {
      granularity: range.granularity,
      from: range.from,
      to: range.to,
      chartData,
      batches,
      summary: summaryRows[0] || { total_batches: 0, total_received_kg: 0, total_available_kg: 0 }
    };
  },

  /**
   * 3. EXPIRY REPORT
   * Single bar graph: Batches expiring over time, stacked by status:
   * (Expired, Expiring ≤7d, Expiring ≤30d, Safe)
   * Expiry monitor table
   * Filtering on batch expiry date (i.expiration_date)
   */
  async getExpiryReport({ granularity = 'daily', from, to }) {
    const range = resolveDateRange({ granularity, from, to });
    const fmt = getDateFormatString(range.granularity);

    // 1. Chart series: stacked by status computed relative to CURDATE()
    const chartSql = `
      SELECT DATE_FORMAT(i.expiration_date, ${fmt}) AS bucket_key,
             SUM(CASE WHEN i.expiration_date < CURDATE() THEN 1 ELSE 0 END) AS expired,
             SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS expiring_7d,
             SUM(CASE WHEN i.expiration_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS expiring_30d,
             SUM(CASE WHEN i.expiration_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS safe,
             COUNT(i.id) AS total_batches
      FROM inventory i
      WHERE i.expiration_date BETWEEN ? AND ?
      GROUP BY bucket_key
    `;
    const chartRows = await query(chartSql, [range.from, range.to]);
    const chartMap = {};
    for (const r of chartRows) {
      chartMap[r.bucket_key] = {
        expired: Number(r.expired) || 0,
        expiring_7d: Number(r.expiring_7d) || 0,
        expiring_30d: Number(r.expiring_30d) || 0,
        safe: Number(r.safe) || 0,
        total_batches: Number(r.total_batches) || 0
      };
    }

    const buckets = generateContinuousBuckets(range.from, range.to, range.granularity);
    const chartData = buckets.map((b) => {
      const match = chartMap[b.key] || { expired: 0, expiring_7d: 0, expiring_30d: 0, safe: 0, total_batches: 0 };
      return {
        key: b.key,
        label: b.label,
        expired: match.expired,
        expiring_7d: match.expiring_7d,
        expiring_30d: match.expiring_30d,
        safe: match.safe,
        total_batches: match.total_batches
      };
    });

    // 2. Expiry Monitor Table
    const tableSql = `
      SELECT i.id, i.batch_no, p.name AS product_name, s.name AS supplier_name,
             i.available_stock_kg, i.expiration_date,
             CASE
               WHEN i.expiration_date < CURDATE() THEN 'Expired'
               WHEN i.expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 'Expiring ≤7d'
               WHEN i.expiration_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 8 DAY) AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'Expiring ≤30d'
               ELSE 'Safe'
             END AS expiry_flag
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.expiration_date BETWEEN ? AND ?
      ORDER BY i.expiration_date ASC
    `;
    const batches = await query(tableSql, [range.from, range.to]);

    // 3. Summary counts
    const summarySql = `
      SELECT COUNT(i.id) AS total_batches,
             SUM(CASE WHEN i.expiration_date < CURDATE() THEN 1 ELSE 0 END) AS total_expired,
             SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS total_expiring_7d,
             SUM(CASE WHEN i.expiration_date > DATE_ADD(CURDATE(), INTERVAL 7 DAY) AND i.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS total_expiring_30d,
             SUM(CASE WHEN i.expiration_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS total_safe
      FROM inventory i
      WHERE i.expiration_date BETWEEN ? AND ?
    `;
    const summaryRows = await query(summarySql, [range.from, range.to]);

    return {
      granularity: range.granularity,
      from: range.from,
      to: range.to,
      chartData,
      batches,
      summary: summaryRows[0] || {
        total_batches: 0,
        total_expired: 0,
        total_expiring_7d: 0,
        total_expiring_30d: 0,
        total_safe: 0
      }
    };
  },

  /**
   * 4. SUPPLIERS REPORT
   * Single bar graph: Supply volume (kg) over time
   * Supplier summary table: Grouped strictly by supplier id/name so no duplicate rows occur
   * Filtering on delivery date (COALESCE(date_processed, DATE(created_at)))
   */
  async getSupplierReport({ granularity = 'daily', from, to }) {
    const range = resolveDateRange({ granularity, from, to });
    const fmt = getDateFormatString(range.granularity);

    // 1. Chart series: supply volume (kg) over time
    const chartSql = `
      SELECT DATE_FORMAT(COALESCE(i.date_processed, DATE(i.created_at)), ${fmt}) AS bucket_key,
             COALESCE(SUM(i.weight_kg), 0) AS supply_volume_kg,
             COUNT(i.id) AS batches_count
      FROM inventory i
      WHERE COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
      GROUP BY bucket_key
    `;
    const chartRows = await query(chartSql, [range.from, range.to]);
    const chartMap = {};
    for (const r of chartRows) {
      chartMap[r.bucket_key] = {
        supply_volume_kg: Number(r.supply_volume_kg) || 0,
        batches_count: Number(r.batches_count) || 0
      };
    }

    const buckets = generateContinuousBuckets(range.from, range.to, range.granularity);
    const chartData = buckets.map((b) => {
      const match = chartMap[b.key] || { supply_volume_kg: 0, batches_count: 0 };
      return {
        key: b.key,
        label: b.label,
        supply_volume_kg: match.supply_volume_kg,
        batches_count: match.batches_count
      };
    });

    // 2. Supplier Summary Table (Grouped by supplier name so same supplier doesn't appear multiple times)
    const tableSql = `
      SELECT MIN(s.id) AS id,
             MIN(s.id) AS supplier_id,
             s.name AS supplier_name,
             MIN(s.contact_person) AS contact_person,
             MIN(s.phone) AS phone,
             MIN(s.email) AS email,
             COUNT(i.id) AS total_batches_supplied,
             COALESCE(SUM(i.weight_kg), 0) AS total_weight_supplied_kg
      FROM suppliers s
      LEFT JOIN inventory i ON s.id = i.supplier_id
        AND COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
      GROUP BY s.name
      ORDER BY total_weight_supplied_kg DESC, s.name ASC
    `;
    const suppliers = await query(tableSql, [range.from, range.to]);

    // 3. Summary metrics
    const summarySql = `
      SELECT COUNT(DISTINCT s.id) AS active_suppliers_count,
             COALESCE(SUM(i.weight_kg), 0) AS total_volume_kg,
             COUNT(i.id) AS total_batches_count
      FROM suppliers s
      INNER JOIN inventory i ON s.id = i.supplier_id
      WHERE COALESCE(i.date_processed, DATE(i.created_at)) BETWEEN ? AND ?
    `;
    const summaryRows = await query(summarySql, [range.from, range.to]);

    return {
      granularity: range.granularity,
      from: range.from,
      to: range.to,
      chartData,
      suppliers,
      summary: summaryRows[0] || {
        active_suppliers_count: 0,
        total_volume_kg: 0,
        total_batches_count: 0
      }
    };
  }
};

module.exports = ReportModel;
