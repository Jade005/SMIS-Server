const { pool, query } = require('./db');

async function migrateOrderItemsPriceSnapshot() {
  console.log('=== Starting Migration: Order Items Price Snapshot & Backfill ===');

  try {
    // 1. Inspect existing columns in order_items
    const columns = await query('DESCRIBE order_items');
    const columnNames = columns.map(c => c.Field);

    // 2. Add unit_price if missing
    if (!columnNames.includes('unit_price')) {
      console.log('Adding column "unit_price" to order_items...');
      await query('ALTER TABLE order_items ADD COLUMN unit_price DECIMAL(10,2) NULL AFTER price_per_kg');
      console.log('Added column "unit_price".');
    } else {
      console.log('Column "unit_price" already exists.');
    }

    // 3. Add price_at_order if missing
    if (!columnNames.includes('price_at_order')) {
      console.log('Adding column "price_at_order" to order_items...');
      await query('ALTER TABLE order_items ADD COLUMN price_at_order DECIMAL(10,2) NULL AFTER unit_price');
      console.log('Added column "price_at_order".');
    } else {
      console.log('Column "price_at_order" already exists.');
    }

    // 4. Add line_total if missing
    if (!columnNames.includes('line_total')) {
      console.log('Adding column "line_total" to order_items...');
      await query('ALTER TABLE order_items ADD COLUMN line_total DECIMAL(10,2) NULL AFTER subtotal');
      console.log('Added column "line_total".');
    } else {
      console.log('Column "line_total" already exists.');
    }

    // 5. Backfill existing orders
    const rows = await query(`
      SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.weight_kg,
             oi.price_per_kg, oi.unit_price, oi.price_at_order, oi.subtotal, oi.line_total,
             o.order_no, o.total_amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ORDER BY oi.id ASC
    `);

    console.log(`Analyzing ${rows.length} existing order_items rows for backfill...`);

    let backfilledCount = 0;
    let flaggedCount = 0;

    for (const row of rows) {
      let resolvedUnitPrice = null;

      // Check existing candidate price values
      if (row.price_at_order !== null && Number(row.price_at_order) > 0) {
        resolvedUnitPrice = Number(row.price_at_order);
      } else if (row.unit_price !== null && Number(row.unit_price) > 0) {
        resolvedUnitPrice = Number(row.unit_price);
      } else if (row.price_per_kg !== null && Number(row.price_per_kg) > 0) {
        resolvedUnitPrice = Number(row.price_per_kg);
      } else if (row.subtotal !== null && Number(row.subtotal) > 0 && Number(row.weight_kg) > 0) {
        resolvedUnitPrice = Math.round((Number(row.subtotal) / Number(row.weight_kg)) * 100) / 100;
      } else if (row.line_total !== null && Number(row.line_total) > 0 && Number(row.weight_kg) > 0) {
        resolvedUnitPrice = Math.round((Number(row.line_total) / Number(row.weight_kg)) * 100) / 100;
      }

      if (resolvedUnitPrice === null || resolvedUnitPrice <= 0) {
        console.warn(`[FLAGGED] Row ID ${row.id} (Order #${row.order_no}, Product: ${row.product_name}): Price could not be recovered automatically! Total amount: ${row.total_amount}`);
        flaggedCount++;
        continue;
      }

      const resolvedLineTotal = Number(row.subtotal || row.line_total || (Number(row.weight_kg) * resolvedUnitPrice));

      // Update row with unit_price, price_at_order, line_total, and price_per_kg
      await query(`
        UPDATE order_items
        SET unit_price = ?,
            price_at_order = ?,
            price_per_kg = ?,
            line_total = ?,
            subtotal = ?
        WHERE id = ?
      `, [resolvedUnitPrice, resolvedUnitPrice, resolvedUnitPrice, resolvedLineTotal, resolvedLineTotal, row.id]);

      console.log(`[BACKFILLED] Row ID ${row.id} (Order #${row.order_no}, ${row.product_name}): unit_price = ₱${resolvedUnitPrice.toFixed(2)}/kg, line_total = ₱${resolvedLineTotal.toFixed(2)} (weight: ${row.weight_kg} kg)`);
      backfilledCount++;
    }

    console.log(`=== Migration Finished: ${backfilledCount} rows verified/backfilled, ${flaggedCount} flagged ===`);
  } catch (err) {
    console.error('Migration failed with error:', err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateOrderItemsPriceSnapshot();
