const { pool, query } = require('../config/db');
const { generateReceiptNo } = require('../utils/receiptGenerator');

const SaleModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT s.*,
             CONCAT(u.first_name, ' ', u.last_name) AS cashier_name,
             CONCAT(cu.first_name, ' ', cu.last_name) AS customer_name
      FROM sales s
      INNER JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users cu ON c.user_id = cu.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.cashier_id) {
      sql += ' AND s.cashier_id = ?';
      params.push(filters.cashier_id);
    }

    if (filters.date) {
      sql += ' AND DATE(s.created_at) = ?';
      params.push(filters.date);
    }

    sql += ' ORDER BY s.created_at DESC';
    return await query(sql, params);
  },

  async getById(id) {
    const saleSql = `
      SELECT s.*,
             CONCAT(u.first_name, ' ', u.last_name) AS cashier_name,
             CONCAT(cu.first_name, ' ', cu.last_name) AS customer_name
      FROM sales s
      INNER JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users cu ON c.user_id = cu.id
      WHERE s.id = ?
    `;
    const sales = await query(saleSql, [id]);
    if (!sales || sales.length === 0) return null;

    const itemsSql = `
      SELECT si.*
      FROM sales_items si
      WHERE si.sale_id = ?
    `;
    const items = await query(itemsSql, [id]);

    return {
      ...sales[0],
      items
    };
  },

  // Process POS Sale with Database Transaction and Auto-Deduction from Inventory
  async createSale({ cashier_id, customer_id = null, items = [], discount = 0, payment_method = 'cash', amount_tendered = 0, notes = null }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let subtotal = 0;
      const receipt_no = generateReceiptNo();
      const saleItemsToInsert = [];

      for (const item of items) {
        const { inventory_id, weight_kg } = item;

        // Fetch batch details and lock row for update
        const [batchRows] = await connection.query(
          `SELECT i.*, p.name AS product_name, p.meat_cut
           FROM inventory i
           INNER JOIN products p ON i.product_id = p.id
           WHERE i.id = ? FOR UPDATE`,
          [inventory_id]
        );

        if (!batchRows || batchRows.length === 0) {
          throw new Error(`Inventory batch #${inventory_id} not found`);
        }

        const batch = batchRows[0];

        if (Number(batch.available_stock_kg) < Number(weight_kg)) {
          throw new Error(`Insufficient stock for ${batch.product_name} (${batch.meat_cut}). Available: ${batch.available_stock_kg} kg, Requested: ${weight_kg} kg`);
        }

        const itemSubtotal = Number(weight_kg) * Number(batch.price_per_kg);
        subtotal += itemSubtotal;

        // Calculate new available stock
        const newAvailableStock = Number(batch.available_stock_kg) - Number(weight_kg);
        let newStatus = batch.status;

        if (newAvailableStock <= 0) {
          newStatus = 'depleted';
        } else if (newAvailableStock <= 10) {
          newStatus = 'low';
        }

        // Auto-deduct inventory
        await connection.query(
          `UPDATE inventory
           SET available_stock_kg = ?, status = ?
           WHERE id = ?`,
          [newAvailableStock, newStatus, inventory_id]
        );

        saleItemsToInsert.push({
          inventory_id,
          product_id: batch.product_id,
          product_name: batch.product_name,
          meat_cut: batch.meat_cut,
          weight_kg: Number(weight_kg),
          price_per_kg: Number(batch.price_per_kg),
          subtotal: itemSubtotal
        });
      }

      const total_amount = subtotal - Number(discount);
      const change_amount = Number(amount_tendered) >= total_amount ? Number(amount_tendered) - total_amount : 0;

      // Insert sale header
      const [saleResult] = await connection.query(
        `INSERT INTO sales (cashier_id, customer_id, receipt_no, subtotal, discount, total_amount, payment_method, amount_tendered, change_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [cashier_id, customer_id, receipt_no, subtotal, discount, total_amount, payment_method, amount_tendered, change_amount, notes]
      );

      const saleId = saleResult.insertId;

      // Insert line items
      for (const item of saleItemsToInsert) {
        await connection.query(
          `INSERT INTO sales_items (sale_id, inventory_id, product_id, product_name, meat_cut, weight_kg, price_per_kg, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [saleId, item.inventory_id, item.product_id, item.product_name, item.meat_cut, item.weight_kg, item.price_per_kg, item.subtotal]
        );
      }

      await connection.commit();
      connection.release();

      return await this.getById(saleId);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  }
};

module.exports = SaleModel;
