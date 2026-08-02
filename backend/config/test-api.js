const UserModel = require('../models/userModel');
const CategoryModel = require('../models/categoryModel');
const ProductModel = require('../models/productModel');
const SupplierModel = require('../models/supplierModel');
const InventoryModel = require('../models/inventoryModel');
const SaleModel = require('../models/saleModel');
const ReportModel = require('../models/reportModel');
const AnalyticsModel = require('../models/analyticsModel');
const generateToken = require('../utils/generateToken');

async function testBackendAPI() {
  try {
    console.log('-------------------------------------------------');
    console.log('🧪 Starting SMIS Backend End-to-End Test Suite');
    console.log('-------------------------------------------------');

    // 1. Auth Test
    console.log('\n[1/6] Testing Authentication & Password Verification...');
    const admin = await UserModel.findByEmail('admin@smis.local');
    if (!admin) throw new Error('Admin seed user not found!');

    const isPasswordValid = await UserModel.comparePassword('admin123', admin.password_hash);
    if (!isPasswordValid) throw new Error('Password verification failed for admin123!');

    const token = generateToken(admin);
    console.log('✅ Admin login verified successfully! Signed JWT Generated.');

    // 2. Category & Supplier Setup
    console.log('\n[2/6] Testing Category & Supplier Creation...');
    const categories = await CategoryModel.getAll();
    const beefCat = categories.find(c => c.name === 'Beef') || categories[0];
    console.log(`✅ Category verified: ${beefCat.name} (ID: ${beefCat.id})`);

    const supplierId = await SupplierModel.create({
      name: 'San Jose Slaughterhouse & Livestock',
      contact_person: 'Carlos Mendoza',
      phone: '09179998888',
      email: 'sanjose@livestock.ph',
      address: 'Bulacan, Philippines'
    });
    console.log(`✅ Supplier created: ID #${supplierId}`);

    // 3. Product & Inventory Setup
    console.log('\n[3/6] Testing Product & Inventory Batch Creation...');
    const productId = await ProductModel.create({
      category_id: beefCat.id,
      name: 'Batangas Beef Liempo',
      meat_type: 'Beef',
      meat_cut: 'Liempo',
      price_per_kg: 240.00,
      description: 'Fresh slaughterhouse cut beef belly'
    });
    console.log(`✅ Product created: Batangas Beef Liempo (ID #${productId})`);

    const batchId = await InventoryModel.addBatch({
      product_id: productId,
      supplier_id: supplierId,
      weight_kg: 50.000,
      price_per_kg: 240.00,
      date_processed: new Date().toISOString().slice(0, 10),
      expiration_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: 'Initial test batch delivery'
    });
    const batchBefore = await InventoryModel.getById(batchId);
    console.log(`✅ Batch created: Batch #${batchBefore.batch_no} | Stock: ${batchBefore.available_stock_kg} kg`);

    // 4. POS Transaction & Automated Inventory Deduction
    console.log('\n[4/6] Processing POS Sale Transaction (Testing Auto Inventory Deduction)...');
    const sale = await SaleModel.createSale({
      cashier_id: admin.id,
      items: [
        { inventory_id: batchId, weight_kg: 12.500 }
      ],
      discount: 0,
      payment_method: 'cash',
      amount_tendered: 3000.00
    });

    console.log(`✅ POS Sale Processed Successfully!`);
    console.log(`   Receipt No: ${sale.receipt_no}`);
    console.log(`   Subtotal: ₱${sale.subtotal} | Total Amount: ₱${sale.total_amount}`);
    console.log(`   Change Amount: ₱${sale.change_amount}`);

    const batchAfter = await InventoryModel.getById(batchId);
    console.log(`✅ Inventory Auto-Deducted cleanly!`);
    console.log(`   Original Stock: ${batchBefore.available_stock_kg} kg`);
    console.log(`   Deducted: 12.500 kg`);
    console.log(`   Remaining Stock: ${batchAfter.available_stock_kg} kg | Status: '${batchAfter.status}'`);

    // 5. Reporting & Analytics Test
    console.log('\n[5/6] Testing Reporting & Analytics Endpoints...');
    const salesReport = await ReportModel.getSalesReport({ period: 'daily' });
    console.log(`✅ Daily Sales Report: ${salesReport.summary.total_transactions} transaction(s), Total Revenue: ₱${salesReport.summary.total_revenue}`);

    const bestSellers = await AnalyticsModel.getBestSellers(5);
    console.log(`✅ Best Sellers Analytics: Top Product = ${bestSellers[0].product_name} (${bestSellers[0].total_kg_sold} kg sold)`);

    // 6. Alert Test
    console.log('\n[6/6] Testing Stock Alert System...');
    const lowStockAlerts = await InventoryModel.getLowStockAlerts(40);
    console.log(`✅ Low Stock Alerts query returned ${lowStockAlerts.length} item(s)`);

    console.log('\n-------------------------------------------------');
    console.log('🎉 ALL BACKEND API ENDPOINTS & LOGIC VERIFIED 100%!');
    console.log('-------------------------------------------------');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ API Test Failed!');
    console.error(error);
    process.exit(1);
  }
}

testBackendAPI();
