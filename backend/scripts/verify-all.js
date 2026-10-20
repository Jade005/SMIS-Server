const { query } = require('../config/db');
const InventoryModel = require('../models/inventoryModel');
const ProductModel = require('../models/productModel');

async function verifyAll() {
  console.log('======================================================================');
  console.log('                 SMIS SYSTEM VERIFICATION REPORT                     ');
  console.log('======================================================================\n');

  // 1. Inventory Batches count per tab
  const counts = await InventoryModel.getCounts();
  console.log('1. INVENTORY BATCHES COUNT PER TAB:');
  console.log(`   - All: ${counts.all_count}`);
  console.log(`   - Active: ${counts.active_count}`);
  console.log(`   - Low Stock: ${counts.low_count}`);
  console.log(`   - Expired: ${counts.expired_count} (${Number(counts.expired_total_kg).toFixed(3)} kg)`);
  console.log(`   - Disposed: ${counts.disposed_count}`);
  console.log('');

  // 2. Dashboard low stock and expired counts
  const lowAlerts = await InventoryModel.getLowStockAlerts();
  const expAlerts = await InventoryModel.getExpiredAlerts();
  console.log('2. DASHBOARD KPI COUNTS:');
  console.log(`   - Low Stock Products Alert Count: ${lowAlerts.length}`);
  console.log(`   - Expired Batches Alert Count: ${expAlerts.length}`);
  console.log('');

  // 3. Products & Cuts stock per product
  const activeProducts = await ProductModel.getAll({ is_active: 1 });
  console.log('3. PRODUCTS & CUTS STOCK PER ACTIVE PRODUCT:');
  for (const p of activeProducts) {
    console.log(`   - [ID #${p.id}] ${p.name} (${p.meat_cut}): ${Number(p.total_available_stock_kg).toFixed(3)} kg | Status: ${p.stock_status} | Price: ₱${Number(p.price_per_kg).toFixed(2)}/kg`);
  }
  console.log('');

  // 4. Compare Cashier POS and Customer Shop stock
  console.log('4. CASHIER POS VS CUSTOMER SHOP STOCK COMPARISON:');
  const posBatches = await InventoryModel.getAll({ tab: 'active' });

  // Aggregate posBatches per product
  const posStockMap = {};
  for (const b of posBatches) {
    posStockMap[b.product_id] = (posStockMap[b.product_id] || 0) + Number(b.available_stock_kg);
  }

  let mismatchCount = 0;
  for (const p of activeProducts) {
    const shopStock = Number(p.total_available_stock_kg);
    const posStock = posStockMap[p.id] || 0;
    if (Math.abs(shopStock - posStock) > 0.001) {
      console.log(`   ❌ MISMATCH for Product #${p.id} (${p.name}): Shop has ${shopStock} kg, POS has ${posStock} kg`);
      mismatchCount++;
    }
  }

  if (mismatchCount === 0) {
    console.log(`   ✅ 100% MATCH: All ${activeProducts.length} active products have identical available stock on Cashier POS and Customer Shop!`);
  }

  console.log('\n======================================================================');
  process.exit(0);
}

verifyAll().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
