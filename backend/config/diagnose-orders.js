/**
 * Diagnostic script: checks the orders table and customer mapping
 * to identify why "My Orders" shows the same data for all customers.
 *
 * Run:  node backend/config/diagnose-orders.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query, pool } = require('./db');

async function diagnose() {
  console.log('\n=== DIAGNOSTIC: Order / Customer Data ===\n');

  // 1. How many distinct customer_ids exist in the orders table?
  const distinctCustomers = await query(
    'SELECT customer_id, COUNT(*) AS order_count FROM orders GROUP BY customer_id ORDER BY customer_id'
  );
  console.log('1. Distinct customer_ids in `orders` table:');
  console.table(distinctCustomers);

  // 2. Show the mapping:  users.id → customers.id for all customer-role users
  const customerMapping = await query(`
    SELECT u.id AS user_id, u.first_name, u.last_name, u.role,
           c.id AS customers_table_id
    FROM users u
    LEFT JOIN customers c ON c.user_id = u.id
    WHERE u.role = 'customer'
    ORDER BY u.id
  `);
  console.log('\n2. User → Customer mapping (role=customer):');
  console.table(customerMapping);

  // 3. For each customer user, show what CustomerModel.getByUserId would return
  console.log('\n3. Simulating CustomerModel.getByUserId for each customer user:');
  for (const cm of customerMapping) {
    const rows = await query(`
      SELECT 
        u.id AS user_id,
        c.id AS customer_id
      FROM users u
      LEFT JOIN customers c ON c.user_id = u.id
      WHERE u.id = ?
    `, [cm.user_id]);
    const row = rows[0];
    console.log(`   User ${cm.user_id} (${cm.first_name} ${cm.last_name}): ` +
      `customer_id=${row?.customer_id ?? 'NULL'}`);

    // Now show what OrderModel.getAll({ customer_id: row.customer_id }) would return
    if (row?.customer_id) {
      const orders = await query(
        'SELECT id, order_no, customer_id, status FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5',
        [row.customer_id]
      );
      console.log(`     → Orders with customer_id=${row.customer_id}: ${orders.length} found`);
      if (orders.length > 0) {
        orders.forEach(o => console.log(`       #${o.order_no}  customer_id=${o.customer_id}  status=${o.status}`));
      }
    } else {
      console.log(`     → No customer record, would return [] (empty)`);
    }
  }

  // 4. Show a sample of orders with their customer_id to verify they're not all the same
  const sampleOrders = await query(`
    SELECT o.id, o.order_no, o.customer_id, o.status, o.created_at,
           CONCAT(u.first_name, ' ', u.last_name) AS customer_name
    FROM orders o
    INNER JOIN customers c ON o.customer_id = c.id
    INNER JOIN users u ON c.user_id = u.id
    ORDER BY o.created_at DESC
    LIMIT 20
  `);
  console.log('\n4. Recent 20 orders (order_no → customer_id → customer_name):');
  console.table(sampleOrders.map(o => ({
    order_no: o.order_no,
    customer_id: o.customer_id,
    customer_name: o.customer_name,
    status: o.status
  })));

  await pool.end();
  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
}

diagnose().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
