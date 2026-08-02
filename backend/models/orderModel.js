const { pool, query } = require('../config/db');
const { generateOrderNo } = require('../utils/receiptGenerator');

const OrderModel = {
  async getAll(filters = {}) {
    let sql = `
      SELECT o.*,
             CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
             u.email AS customer_email,
             c.phone AS customer_phone
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.customer_id) {
      sql += ' AND o.customer_id = ?';
      params.push(filters.customer_id);
    }

    if (filters.status) {
      sql += ' AND o.status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY o.created_at DESC';
    return await query(sql, params);
  },

  async getById(id) {
    const orderSql = `
      SELECT o.*,
             CONCAT(u.first_name, ' ', u.last_name) AS customer_name,
             u.email AS customer_email,
             c.phone AS customer_phone
      FROM orders o
      INNER JOIN customers c ON o.customer_id = c.id
      INNER JOIN users u ON c.user_id = u.id
      WHERE o.id = ?
    `;
    const orders = await query(orderSql, [id]);
    if (!orders || orders.length === 0) return null;

    const itemsSql = `SELECT * FROM order_items WHERE order_id = ?`;
    const items = await query(itemsSql, [id]);

    return {
      ...orders[0],
      items
    };
  },

  async createOrder({ customer_id, items = [], notes = null }) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const order_no = generateOrderNo();
      let subtotal = 0;
      const orderItemsToInsert = [];

      for (const item of items) {
        const { product_id, weight_kg } = item;

        const [products] = await connection.query(
          `SELECT name, meat_cut, price_per_kg FROM products WHERE id = ?`,
          [product_id]
        );

        if (!products || products.length === 0) {
          throw new Error(`Product #${product_id} not found`);
        }

        const prod = products[0];
        const itemSubtotal = Number(weight_kg) * Number(prod.price_per_kg);
        subtotal += itemSubtotal;

        orderItemsToInsert.push({
          product_id,
          product_name: prod.name,
          meat_cut: prod.meat_cut,
          weight_kg: Number(weight_kg),
          price_per_kg: Number(prod.price_per_kg),
          subtotal: itemSubtotal
        });
      }

      const total_amount = subtotal;

      const [orderResult] = await connection.query(
        `INSERT INTO orders (customer_id, order_no, status, subtotal, total_amount, notes)
         VALUES (?, ?, 'pending', ?, ?, ?)`,
        [customer_id, order_no, subtotal, total_amount, notes]
      );

      const orderId = orderResult.insertId;

      for (const item of orderItemsToInsert) {
        await connection.query(
          `INSERT INTO order_items (order_id, product_id, product_name, meat_cut, weight_kg, price_per_kg, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [orderId, item.product_id, item.product_name, item.meat_cut, item.weight_kg, item.price_per_kg, item.subtotal]
        );
      }

      await connection.commit();
      connection.release();

      return await this.getById(orderId);
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  },

  async updateStatus(id, status) {
    await query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    return this.getById(id);
  }
};

module.exports = OrderModel;
