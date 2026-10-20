const { query } = require('../config/db');

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function restock() {
  console.log('=== Checking and Executing Fresh 50kg Restock ===');

  // Supplier #1 is our verified primary supplier (San Jose Slaughterhouse & Livestock)
  const [supplier] = await query('SELECT id, name FROM suppliers WHERE id = 1');
  if (!supplier) {
    throw new Error('Supplier #1 not found in database');
  }
  console.log(`Using Supplier: #${supplier.id} - ${supplier.name}`);

  // Fetch all active products
  const activeProducts = await query(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.is_active = 1
    ORDER BY p.id ASC
  `);

  console.log(`Found ${activeProducts.length} active products to check.`);

  const today = new Date();
  const todayStr = formatDate(today);

  let createdCount = 0;
  let skippedCount = 0;

  for (const prod of activeProducts) {
    // Check total non-expired, non-disposed available stock
    const [stockRow] = await query(`
      SELECT COALESCE(SUM(available_stock_kg), 0) AS total_stock
      FROM inventory
      WHERE product_id = ?
        AND expiration_date >= CURDATE()
        AND status NOT IN ('expired', 'disposed', 'depleted')
    `, [prod.id]);

    const currentStock = Number(stockRow.total_stock || 0);

    // Skip products that already have 15 kg or more of non-expired stock
    if (currentStock >= 15.0) {
      console.log(`⏭️  SKIP: Product #${prod.id} "${prod.name}" has ${currentStock.toFixed(3)} kg non-expired stock (>= 15 kg).`);
      skippedCount++;
      continue;
    }

    // Determine expiration date (+3 days for Chicken, +7 days for other meats)
    const isChicken = (prod.meat_type || '').toLowerCase().includes('chicken') ||
                      (prod.category_name || '').toLowerCase().includes('chicken');
    
    const expDate = new Date();
    expDate.setDate(today.getDate() + (isChicken ? 3 : 7));
    const expDateStr = formatDate(expDate);

    // Format a unique batch number
    const randSuffix = Math.floor(100 + Math.random() * 900);
    const cleanDatePart = todayStr.replace(/-/g, '');
    const batchNo = `B-${cleanDatePart}-${prod.id}${randSuffix}`;

    const price = Number(prod.price_per_kg) || 250.00;

    await query(`
      INSERT INTO inventory (
        product_id, supplier_id, batch_no, weight_kg, available_stock_kg,
        price_per_kg, date_processed, expiration_date, status, notes
      ) VALUES (?, ?, ?, 50.000, 50.000, ?, ?, ?, 'available', 'Automated 50kg fresh restock batch')
    `, [prod.id, supplier.id, batchNo, price, todayStr, expDateStr]);

    console.log(`✅ RESTOCKED: Product #${prod.id} "${prod.name}" | Batch: ${batchNo} | 50.000 kg @ ₱${price.toFixed(2)}/kg | Expiry: ${expDateStr} (+${isChicken ? 3 : 7}d)`);
    createdCount++;
  }

  console.log('='.repeat(70));
  console.log(`Restock Summary: ${createdCount} batches created, ${skippedCount} skipped.`);
  console.log('='.repeat(70));

  process.exit(0);
}

restock().catch(err => {
  console.error('Restock script failed:', err);
  process.exit(1);
});
