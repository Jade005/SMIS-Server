const { query } = require('../config/db');

async function inspectDuplicates() {
  const liempoProds = await query('SELECT * FROM products WHERE name LIKE "%Batangas Beef Liempo%" OR id IN (1, 4, 44)');
  console.log('--- Batangas Beef Liempo Products ---');
  console.log(liempoProds);

  for (const p of liempoProds) {
    const batches = await query('SELECT * FROM inventory WHERE product_id = ?', [p.id]);
    console.log(`Batches for product #${p.id} (${p.name}):`, batches);

    const orderItems = await query('SELECT oi.*, o.order_no, o.created_at FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = ?', [p.id]);
    console.log(`Order items for product #${p.id}:`, orderItems.length);

    const saleItems = await query(`
      SELECT si.*, s.receipt_no, s.created_at 
      FROM sales_items si 
      JOIN sales s ON si.sale_id = s.id 
      JOIN inventory inv ON si.inventory_id = inv.id 
      WHERE inv.product_id = ?
    `, [p.id]);
    console.log(`Sale items for product #${p.id}:`, saleItems.length);
  }

  // Also check if there are other duplicate product names across the database
  const dupes = await query(`
    SELECT name, meat_type, meat_cut, COUNT(*) as count, GROUP_CONCAT(id) as ids 
    FROM products 
    GROUP BY LOWER(TRIM(name)) 
    HAVING count > 1
  `);
  console.log('--- All Duplicate Product Names in DB ---');
  console.log(dupes);

  process.exit(0);
}

inspectDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
