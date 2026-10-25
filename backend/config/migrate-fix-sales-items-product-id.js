/**
 * Migration Script: Correct sales_items.product_id backfill
 *
 * ROOT CAUSE:
 * In historical sales_items rows, product_id was sometimes inserted as the inventory (batch) ID
 * instead of the actual products.id reference.
 *
 * THIS SCRIPT:
 * 1. Checks before state (mismatch count between sales_items.product_id and inventory.product_id).
 * 2. Updates sales_items to ensure product_id, product_name, and meat_cut are synchronized
 *    from the inventory batch's real product definition in `products`.
 * 3. Verifies after state.
 *
 * REMINDER:
 * Always ensure a database backup is taken before executing one-time data migrations.
 * Command: mysqldump -u <user> -p smis > smis_backup_before_migration.sql
 */

const { query } = require('./db');

async function migrateSalesItemsProductId() {
  console.log('====================================================');
  console.log('MIGRATION: Backfill & Correct sales_items.product_id');
  console.log('====================================================\n');

  try {
    // 1. BEFORE CHECK
    const [totalRowsResult] = await query('SELECT COUNT(*) AS total FROM sales_items');
    const totalRows = totalRowsResult.total;

    const [beforeMismatchResult] = await query(`
      SELECT COUNT(*) AS mismatch_count
      FROM sales_items si
      JOIN inventory i ON i.id = si.inventory_id
      WHERE si.product_id <> i.product_id
    `);
    const beforeMismatch = beforeMismatchResult.mismatch_count;

    console.log(`[BEFORE] Total rows in sales_items: ${totalRows}`);
    console.log(`[BEFORE] Rows where sales_items.product_id <> inventory.product_id: ${beforeMismatch}`);

    // 2. RUN UPDATE
    console.log('\nExecuting update query...');
    const updateSql = `
      UPDATE sales_items si
      JOIN inventory i ON i.id = si.inventory_id
      JOIN products p ON p.id = i.product_id
      SET si.product_id = i.product_id,
          si.product_name = p.name,
          si.meat_cut = p.meat_cut
    `;
    const updateResult = await query(updateSql);
    console.log(`[UPDATE] Affected rows: ${updateResult.affectedRows || 0}, Changed rows: ${updateResult.changedRows || 0}`);

    // 3. AFTER CHECK
    const [afterMismatchResult] = await query(`
      SELECT COUNT(*) AS mismatch_count
      FROM sales_items si
      JOIN inventory i ON i.id = si.inventory_id
      WHERE si.product_id <> i.product_id
    `);
    const afterMismatch = afterMismatchResult.mismatch_count;

    console.log(`\n[AFTER] Rows where sales_items.product_id <> inventory.product_id: ${afterMismatch}`);

    if (afterMismatch === 0) {
      console.log('✅ Migration succeeded: 100% of sales_items rows match their inventory product_id.');
    } else {
      console.warn(`⚠️ Warning: ${afterMismatch} rows still have mismatches (check if orphan inventory batches exist).`);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  migrateSalesItemsProductId();
}

module.exports = migrateSalesItemsProductId;
