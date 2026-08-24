/**
 * seed-demo-transactions.js
 * Seeds realistic POS transactions across today + the past 7 days,
 * varied inventory batches with low-stock & expired entries,
 * to populate the Admin Dashboard with meaningful KPI data.
 *
 * Run:  node backend/config/seed-demo-transactions.js
 */

const { query, pool } = require('./db');

// ── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min, max) {
  return +(min + Math.random() * (max - min)).toFixed(3);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function receiptNo(dateStr) {
  const d = new Date(dateStr);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RCP-${ymd}-${rand}`;
}

function randomTimeOnDate(dateStr) {
  const d = new Date(dateStr);
  d.setHours(6 + Math.floor(Math.random() * 14));   // 06:00 – 19:59
  d.setMinutes(Math.floor(Math.random() * 60));
  d.setSeconds(Math.floor(Math.random() * 60));
  return d;
}

function mysqlDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function mysqlDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ── Main Seed ────────────────────────────────────────────────────────────────

async function seed() {
  console.log('='.repeat(70));
  console.log('💰 SEEDING DEMO TRANSACTIONS & VARIED INVENTORY');
  console.log('='.repeat(70));

  // 1. Gather cashier users
  const cashiers = await query("SELECT id FROM users WHERE role IN ('admin','cashier')");
  if (cashiers.length === 0) {
    console.error('❌ No cashier/admin users found. Cannot seed sales.');
    process.exit(1);
  }
  const cashierIds = cashiers.map(u => u.id);
  console.log(`👤 Cashiers: ${cashierIds.join(', ')}`);

  // 2. Gather available inventory batches with stock
  const inventory = await query(
    "SELECT id, product_id, available_stock_kg, price_per_kg FROM inventory WHERE status IN ('available','low') AND available_stock_kg > 0.5"
  );
  if (inventory.length < 3) {
    console.error('❌ Not enough inventory batches to seed transactions.');
    process.exit(1);
  }
  console.log(`📦 Usable inventory batches: ${inventory.length}`);

  // 3. Gather product names for line items
  const products = await query('SELECT id, name, meat_cut FROM products');
  const prodMap = {};
  for (const p of products) {
    prodMap[p.id] = p;
  }

  // 4. Build date list: today + past 7 days
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(mysqlDate(d));
  }

  // Transaction counts per day (today gets more):
  //   today: ~20-25, yesterday: 10-15, day-2..7: 5-10
  const txCountByDay = [
    22, 12, 8, 7, 6, 9, 5, 7
  ];

  const paymentMethods = ['cash', 'cash', 'cash', 'gcash', 'gcash', 'card']; // weighted toward cash

  let totalSeeded = 0;

  const connection = await pool.getConnection();

  try {
    for (let dayIdx = 0; dayIdx < dates.length; dayIdx++) {
      const dateStr = dates[dayIdx];
      const txCount = txCountByDay[dayIdx];

      for (let t = 0; t < txCount; t++) {
        // Pick 1-4 line items per transaction
        const lineItemCount = 1 + Math.floor(Math.random() * 3);
        const usedBatchIds = new Set();
        const saleItems = [];
        let subtotal = 0;

        for (let li = 0; li < lineItemCount; li++) {
          // Pick a random inventory batch not already used in this sale
          let batch;
          let attempts = 0;
          do {
            batch = pickRandom(inventory);
            attempts++;
          } while (usedBatchIds.has(batch.id) && attempts < 20);
          if (usedBatchIds.has(batch.id)) continue;
          usedBatchIds.add(batch.id);

          const weight = randBetween(0.3, 5.0);
          const pricePerKg = Number(batch.price_per_kg);
          const itemSubtotal = +(weight * pricePerKg).toFixed(2);
          subtotal += itemSubtotal;

          const prod = prodMap[batch.product_id] || { name: 'Unknown', meat_cut: 'N/A' };

          saleItems.push({
            inventory_id: batch.id,
            product_id: batch.product_id,
            product_name: prod.name,
            meat_cut: prod.meat_cut,
            weight_kg: weight,
            price_per_kg: pricePerKg,
            subtotal: itemSubtotal
          });
        }

        if (saleItems.length === 0) continue;

        const discount = Math.random() < 0.15 ? +(Math.random() * 50).toFixed(2) : 0;
        const totalAmount = +(subtotal - discount).toFixed(2);
        const paymentMethod = pickRandom(paymentMethods);
        const amountTendered = paymentMethod === 'cash'
          ? Math.ceil(totalAmount / 50) * 50
          : totalAmount;
        const changeAmount = +(amountTendered - totalAmount).toFixed(2);

        const txTime = randomTimeOnDate(dateStr);
        const createdAt = mysqlDateTime(txTime);
        const cashierId = pickRandom(cashierIds);
        const receipt = receiptNo(dateStr);

        await connection.beginTransaction();

        const [saleResult] = await connection.query(
          `INSERT INTO sales (cashier_id, customer_id, receipt_no, subtotal, discount, total_amount, payment_method, amount_tendered, change_amount, notes, created_at)
           VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
          [cashierId, receipt, subtotal.toFixed(2), discount, totalAmount, paymentMethod, amountTendered, changeAmount, createdAt]
        );

        const saleId = saleResult.insertId;

        for (const item of saleItems) {
          await connection.query(
            `INSERT INTO sales_items (sale_id, inventory_id, product_id, product_name, meat_cut, weight_kg, price_per_kg, subtotal, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [saleId, item.inventory_id, item.product_id, item.product_name, item.meat_cut, item.weight_kg, item.price_per_kg, item.subtotal, createdAt]
          );
        }

        await connection.commit();
        totalSeeded++;
      }

      console.log(`  📅 ${dateStr}: Seeded ${txCount} transactions`);
    }

    // 5. Seed some LOW-STOCK inventory batches (≤15 kg) across mainstream products
    console.log('\n📦 Seeding additional low-stock and expired inventory batches...');

    const suppliers = await query('SELECT id FROM suppliers LIMIT 1');
    const supplierId = suppliers[0]?.id || 1;

    const lowStockBatches = [
      { product_id: 5, stock: 3.5, exp_offset: 20, status: 'low' },   // Beef Tenderloin
      { product_id: 8, stock: 7.2, exp_offset: 14, status: 'low' },   // T-Bone
      { product_id: 15, stock: 2.0, exp_offset: 10, status: 'low' },  // Pork Belly
      { product_id: 24, stock: 5.8, exp_offset: 8, status: 'low' },   // Whole Dressed Chicken
      { product_id: 33, stock: 1.5, exp_offset: 12, status: 'low' },  // Goat Leg
      { product_id: 10, stock: 12.0, exp_offset: 25, status: 'low' }, // Brisket near threshold
    ];

    const expiredBatches = [
      { product_id: 6, stock: 15.0, exp_offset: -3, status: 'expired' },  // Sirloin
      { product_id: 16, stock: 8.0, exp_offset: -5, status: 'expired' },  // Spareribs
      { product_id: 25, stock: 12.0, exp_offset: -2, status: 'expired' }, // Chicken Breast
      { product_id: 34, stock: 6.0, exp_offset: -7, status: 'expired' },  // Goat Ribs
    ];

    for (const b of [...lowStockBatches, ...expiredBatches]) {
      const exp = new Date(today);
      exp.setDate(exp.getDate() + b.exp_offset);
      const batchNo = `DEMO-${b.status.toUpperCase().slice(0, 3)}-${b.product_id}-${Math.floor(100 + Math.random() * 900)}`;
      const prod = products.find(p => p.id === b.product_id);
      const priceRow = await query('SELECT price_per_kg FROM products WHERE id = ?', [b.product_id]);
      const price = priceRow[0]?.price_per_kg || 300;

      await query(
        `INSERT INTO inventory (product_id, supplier_id, batch_no, weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [b.product_id, supplierId, batchNo, b.stock, b.stock, price, mysqlDate(today), mysqlDate(exp), b.status]
      );
      console.log(`  📦 ${batchNo}: ${prod?.name || `Product #${b.product_id}`} — ${b.stock} kg — ${b.status} — exp ${mysqlDate(exp)}`);
    }

    console.log('='.repeat(70));
    console.log(`🎉 DONE! Seeded ${totalSeeded} demo transactions + ${lowStockBatches.length} low-stock + ${expiredBatches.length} expired batches.`);
    console.log('='.repeat(70));

  } catch (err) {
    await connection.rollback();
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    connection.release();
    process.exit(process.exitCode || 0);
  }
}

seed();
