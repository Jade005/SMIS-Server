const { pool, query } = require('../config/db');
const { generateBatchNo } = require('../utils/receiptGenerator');

const InventoryModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT i.*, p.name AS product_name, p.meat_type, p.meat_cut, p.image_url, p.category_id,
             p.price_per_kg AS product_price_per_kg,
             p.low_stock_threshold, c.name AS category_name, s.name AS supplier_name,
             COALESCE(
               (SELECT SUM(inv.available_stock_kg)
                FROM inventory inv
                WHERE inv.product_id = p.id
                  AND inv.expiration_date >= CURDATE()
                  AND inv.status NOT IN ('expired', 'disposed', 'depleted')),
               0
             ) AS product_total_stock_kg,
             CASE
               WHEN i.status = 'disposed' THEN 'DISPOSED'
               WHEN i.expiration_date < CURDATE() OR i.status = 'expired' THEN 'EXPIRED'
               WHEN i.available_stock_kg = 0 OR i.status = 'depleted' THEN 'SOLD OUT'
               ELSE 'ACTIVE'
             END AS computed_status
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];

    const tab = (filters.tab || filters.status || 'all').toLowerCase();

    if (tab === 'active' || tab === 'available') {
      sql += " AND i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') AND i.available_stock_kg > 0";
    } else if (tab === 'low') {
      sql += " AND i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') AND i.available_stock_kg > 0 AND i.available_stock_kg <= 15";
    } else if (tab === 'expired') {
      sql += " AND (i.expiration_date < CURDATE() OR i.status = 'expired') AND i.status != 'disposed'";
    } else if (tab === 'disposed') {
      sql += " AND i.status = 'disposed'";
    } else {
      // Default 'all': show all batches except disposed
      if (filters.include_disposed !== 'true' && filters.include_disposed !== true) {
        sql += " AND i.status != 'disposed'";
      }
    }

    if (filters.product_id) {
      sql += ' AND i.product_id = ?';
      params.push(filters.product_id);
    }

    if (filters.supplier_id) {
      sql += ' AND i.supplier_id = ?';
      params.push(filters.supplier_id);
    }

    if (filters.search && filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      sql += ' AND (i.batch_no LIKE ? OR p.name LIKE ? OR p.meat_cut LIKE ? OR s.name LIKE ?)';
      params.push(s, s, s, s);
    }

    sql += ' ORDER BY i.created_at DESC';
    return await query(sql, params);
  },

  async getCounts() {
    const sql = `
      SELECT
        COUNT(CASE WHEN status != 'disposed' THEN 1 END) AS all_count,
        COUNT(CASE WHEN expiration_date >= CURDATE() AND status NOT IN ('expired', 'disposed', 'depleted') AND available_stock_kg > 0 THEN 1 END) AS active_count,
        COUNT(CASE WHEN expiration_date >= CURDATE() AND status NOT IN ('expired', 'disposed', 'depleted') AND available_stock_kg > 0 AND available_stock_kg <= 15 THEN 1 END) AS low_count,
        COUNT(CASE WHEN (expiration_date < CURDATE() OR status = 'expired') AND status != 'disposed' THEN 1 END) AS expired_count,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) AS disposed_count,
        COALESCE(SUM(CASE WHEN (expiration_date < CURDATE() OR status = 'expired') AND status != 'disposed' THEN available_stock_kg ELSE 0 END), 0) AS expired_total_kg
      FROM inventory
    `;
    const rows = await query(sql);
    return rows[0] || {
      all_count: 0,
      active_count: 0,
      low_count: 0,
      expired_count: 0,
      disposed_count: 0,
      expired_total_kg: 0
    };
  },

  async getById(id) {
    const sql = `
      SELECT i.*, p.name AS product_name, p.meat_type, p.meat_cut, p.image_url, p.category_id,
             p.low_stock_threshold, c.name AS category_name, s.name AS supplier_name,
             CASE
               WHEN i.status = 'disposed' THEN 'DISPOSED'
               WHEN i.expiration_date < CURDATE() OR i.status = 'expired' THEN 'EXPIRED'
               WHEN i.available_stock_kg = 0 OR i.status = 'depleted' THEN 'SOLD OUT'
               ELSE 'ACTIVE'
             END AS computed_status
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.id = ?
    `;
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async addBatch({ product_id, supplier_id, weight_kg, price_per_kg, date_processed, expiration_date, notes }) {
    const batch_no = generateBatchNo();
    const available_stock_kg = weight_kg;
    const isExpired = new Date(expiration_date) < new Date(new Date().toDateString());
    const status = isExpired ? 'expired' : 'available';

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

  // Per-Product Low Stock Alerts: products whose total non-expired stock <= product.low_stock_threshold and > 0
  async getLowStockAlerts() {
    const sql = `
      SELECT 
        p.id AS product_id,
        p.name AS product_name,
        p.meat_type,
        p.meat_cut,
        p.category_id,
        c.name AS category_name,
        p.low_stock_threshold,
        COALESCE(SUM(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') THEN i.available_stock_kg ELSE 0 END), 0) AS total_available_stock_kg,
        MIN(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') AND i.available_stock_kg > 0 THEN i.expiration_date ELSE NULL END) AS nearest_expiration_date,
        MIN(CASE WHEN i.expiration_date >= CURDATE() AND i.status NOT IN ('expired', 'disposed', 'depleted') AND i.available_stock_kg > 0 THEN i.expiration_date ELSE NULL END) AS nearest_expiry_date
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING total_available_stock_kg > 0 AND total_available_stock_kg <= p.low_stock_threshold
      ORDER BY total_available_stock_kg ASC
    `;
    return await query(sql);
  },

  async getExpiringAlerts(daysAhead = 3) {
    const sql = `
      SELECT i.*, p.name AS product_name, p.meat_cut, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE i.expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND i.status NOT IN ('expired', 'disposed', 'depleted')
        AND i.available_stock_kg > 0
      ORDER BY i.expiration_date ASC
    `;
    return await query(sql, [daysAhead]);
  },

  async getExpiredAlerts() {
    const sql = `
      SELECT i.*, p.name AS product_name, p.meat_cut, s.name AS supplier_name
      FROM inventory i
      INNER JOIN products p ON i.product_id = p.id
      INNER JOIN suppliers s ON i.supplier_id = s.id
      WHERE (i.expiration_date < CURDATE() OR i.status = 'expired') AND i.status != 'disposed'
      ORDER BY i.expiration_date DESC
    `;
    return await query(sql);
  },

  // Soft-dispose a single batch
  async disposeBatch(id, { userId, userName, reason }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.query(
        `SELECT i.*, p.name AS product_name, p.meat_cut
         FROM inventory i
         INNER JOIN products p ON i.product_id = p.id
         WHERE i.id = ? FOR UPDATE`,
        [id]
      );

      if (!rows || rows.length === 0) {
        throw new Error('Batch not found');
      }

      const batch = rows[0];
      if (batch.status === 'disposed') {
        await connection.commit();
        return { message: 'Batch was already disposed', batch };
      }

      const disposedWeight = Number(batch.available_stock_kg) || 0;

      // 1. Record disposal entry
      await connection.query(
        `INSERT INTO inventory_disposals
         (inventory_id, batch_no, product_id, product_name, meat_cut, weight_disposed_kg, disposed_by, disposed_by_name, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batch.id,
          batch.batch_no,
          batch.product_id,
          batch.product_name,
          batch.meat_cut,
          disposedWeight,
          userId || null,
          userName || 'Admin',
          reason || 'Expired stock disposal'
        ]
      );

      // 2. Mark batch status as disposed and zero out available stock
      await connection.query(
        `UPDATE inventory
         SET available_stock_kg = 0, status = 'disposed'
         WHERE id = ?`,
        [id]
      );

      await connection.commit();
      return {
        message: `Batch ${batch.batch_no} disposed successfully (${disposedWeight.toFixed(3)} kg removed).`,
        batch_no: batch.batch_no,
        disposed_weight_kg: disposedWeight
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // Soft-dispose all expired batches
  async disposeAllExpired({ userId, userName, reason }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [expiredBatches] = await connection.query(
        `SELECT i.*, p.name AS product_name, p.meat_cut
         FROM inventory i
         INNER JOIN products p ON i.product_id = p.id
         WHERE (i.expiration_date < CURDATE() OR i.status = 'expired') AND i.status != 'disposed'
         FOR UPDATE`
      );

      if (!expiredBatches || expiredBatches.length === 0) {
        await connection.commit();
        return { disposed_count: 0, total_weight_kg: 0, message: 'No expired batches to dispose.' };
      }

      let totalWeight = 0;

      for (const batch of expiredBatches) {
        const weight = Number(batch.available_stock_kg) || 0;
        totalWeight += weight;

        await connection.query(
          `INSERT INTO inventory_disposals
           (inventory_id, batch_no, product_id, product_name, meat_cut, weight_disposed_kg, disposed_by, disposed_by_name, reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batch.id,
            batch.batch_no,
            batch.product_id,
            batch.product_name,
            batch.meat_cut,
            weight,
            userId || null,
            userName || 'Admin',
            reason || 'Bulk expired stock disposal'
          ]
        );
      }

      await connection.query(
        `UPDATE inventory
         SET available_stock_kg = 0, status = 'disposed'
         WHERE (expiration_date < CURDATE() OR status = 'expired') AND status != 'disposed'`
      );

      await connection.commit();
      return {
        disposed_count: expiredBatches.length,
        total_weight_kg: Number(totalWeight.toFixed(3)),
        message: `Successfully disposed ${expiredBatches.length} expired batches (${totalWeight.toFixed(3)} kg removed from inventory).`
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },

  // Get historical disposal records
  async getDisposals() {
    const sql = `
      SELECT d.*, DATE_FORMAT(d.created_at, '%Y-%m-%d %H:%i') as formatted_date
      FROM inventory_disposals d
      ORDER BY d.created_at DESC
    `;
    return await query(sql);
  }
};

module.exports = InventoryModel;

