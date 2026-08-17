const { query } = require('./db');

const CATEGORIES = [
  { name: 'Beef', description: 'Premium cattle-sourced meat and specialty cuts' },
  { name: 'Pork', description: 'Fresh swine-sourced cuts, belly, and ribs' },
  { name: 'Chicken', description: 'Farm-fresh dressed poultry and chicken cuts' },
  { name: 'Goat', description: 'Fresh chevon meat, ribs, and stew cuts' },
  { name: 'Rabbit', description: 'Lean, tender farmed rabbit meat cuts' },
  { name: 'Others', description: 'Specialty meats and slaughterhouse offals' }
];

// Curated high quality realistic product photography for every meat cut
const PRODUCTS_DATA = [
  // ── BEEF CUTS ──────────────────────────────────────────────────────
  {
    category: 'Beef',
    name: 'Beef Tenderloin (Filet Mignon)',
    meat_type: 'Beef',
    meat_cut: 'Tenderloin',
    price_per_kg: 780.00,
    description: 'Ultra-tender, melt-in-your-mouth lean beef cut perfect for steaks and roasting.',
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    stock_kg: 28.5
  },
  {
    category: 'Beef',
    name: 'Prime Sirloin Steak',
    meat_type: 'Beef',
    meat_cut: 'Sirloin',
    price_per_kg: 520.00,
    description: 'Juicy, flavorful sirloin cut with balanced marbling and rich beef flavor.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 35.0
  },
  {
    category: 'Beef',
    name: 'Ribeye Steak Cut',
    meat_type: 'Beef',
    meat_cut: 'Ribeye',
    price_per_kg: 680.00,
    description: 'Heavily marbled premium ribeye for maximum tenderness and smoky flavor.',
    image_url: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?auto=format&fit=crop&w=600&q=80',
    stock_kg: 22.0
  },
  {
    category: 'Beef',
    name: 'T-Bone Steak',
    meat_type: 'Beef',
    meat_cut: 'T-Bone',
    price_per_kg: 620.00,
    description: 'Classic cut featuring both flavorful strip and tender tenderloin on the bone.',
    image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    stock_kg: 18.0
  },
  {
    category: 'Beef',
    name: 'New York Striploin',
    meat_type: 'Beef',
    meat_cut: 'Striploin',
    price_per_kg: 560.00,
    description: 'Lean strip loin cut with a distinct strip of flavorful fat on the edge.',
    image_url: 'https://images.unsplash.com/photo-1594041680534-e8c8cdebd659?auto=format&fit=crop&w=600&q=80',
    stock_kg: 26.0
  },
  {
    category: 'Beef',
    name: 'Beef Brisket Point & Flat',
    meat_type: 'Beef',
    meat_cut: 'Brisket',
    price_per_kg: 380.00,
    description: 'Ideal for slow smoking, braising, corned beef, or Filipino beef pares.',
    image_url: 'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=600&q=80',
    stock_kg: 45.0
  },
  {
    category: 'Beef',
    name: 'Beef Chuck Roast Cut',
    meat_type: 'Beef',
    meat_cut: 'Chuck',
    price_per_kg: 360.00,
    description: 'Rich beef shoulder cut with connective tissue that yields rich savory stew.',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 40.0
  },
  {
    category: 'Beef',
    name: 'Beef Shank (Bulalo Cut)',
    meat_type: 'Beef',
    meat_cut: 'Shank',
    price_per_kg: 390.00,
    description: 'Center-cut bone-in beef marrow shank, perfect for classic Nilagang Bulalo.',
    image_url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80',
    stock_kg: 32.0
  },
  {
    category: 'Beef',
    name: 'Beef Short Ribs',
    meat_type: 'Beef',
    meat_cut: 'Short Ribs',
    price_per_kg: 480.00,
    description: 'Meaty bone-in ribs with great marbling for Korean BBQ or braising.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 19.5
  },
  {
    category: 'Beef',
    name: 'Fresh Ground Beef (80/20)',
    meat_type: 'Beef',
    meat_cut: 'Ground Meat',
    price_per_kg: 320.00,
    description: 'Freshly ground lean beef and fat ratio for juicy burger patties and meatballs.',
    image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    stock_kg: 50.0
  },
  {
    category: 'Beef',
    name: 'Batangas Beef Liempo',
    meat_type: 'Beef',
    meat_cut: 'Liempo',
    price_per_kg: 360.00,
    description: 'Fresh local Batangas beef belly with tender alternating layers of meat and fat.',
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    stock_kg: 30.0
  },

  // ── PORK CUTS ──────────────────────────────────────────────────────
  {
    category: 'Pork',
    name: 'Pork Belly (Liempo Cut)',
    meat_type: 'Pork',
    meat_cut: 'Pork Belly',
    price_per_kg: 340.00,
    description: 'Prime layered pork belly cut with crispy skin capability for Inihaw or Lechon Kawali.',
    image_url: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=600&q=80',
    stock_kg: 60.0
  },
  {
    category: 'Pork',
    name: 'Pork Loin Roast',
    meat_type: 'Pork',
    meat_cut: 'Pork Loin',
    price_per_kg: 290.00,
    description: 'Lean and tender pork center loin, great for roasting, curing, or pork medallions.',
    image_url: 'https://images.unsplash.com/photo-1432139555190-58524dae6a55?auto=format&fit=crop&w=600&q=80',
    stock_kg: 38.0
  },
  {
    category: 'Pork',
    name: 'Pork Chops (Bone-In)',
    meat_type: 'Pork',
    meat_cut: 'Pork Chop',
    price_per_kg: 280.00,
    description: 'Thick-cut bone-in pork loin chops with succulent rim of fat for pan-frying.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 42.0
  },
  {
    category: 'Pork',
    name: 'Pork Shoulder (Kasim / Boston Butt)',
    meat_type: 'Pork',
    meat_cut: 'Pork Shoulder',
    price_per_kg: 270.00,
    description: 'Flavorful shoulder cut with great fat distribution, ideal for Menudo and Adobo.',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 55.0
  },
  {
    category: 'Pork',
    name: 'Pork Leg (Pigue / Ham Cut)',
    meat_type: 'Pork',
    meat_cut: 'Pork Leg',
    price_per_kg: 260.00,
    description: 'Lean hind leg cut perfect for curing ham, sweet pork barbecue, and stir-fries.',
    image_url: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=600&q=80',
    stock_kg: 48.0
  },
  {
    category: 'Pork',
    name: 'Pork Tenderloin (Solomillo)',
    meat_type: 'Pork',
    meat_cut: 'Pork Tenderloin',
    price_per_kg: 360.00,
    description: 'The most tender cut of pork, very lean and fast-cooking for quick gourmet meals.',
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    stock_kg: 20.0
  },
  {
    category: 'Pork',
    name: 'Pork Spare Ribs',
    meat_type: 'Pork',
    meat_cut: 'Pork Ribs',
    price_per_kg: 330.00,
    description: 'Meaty slab of pork ribs perfect for sticky barbecue glazes or Sinigang.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 36.0
  },
  {
    category: 'Pork',
    name: 'Pork Hock (Pata Cut for Crispy Pata)',
    meat_type: 'Pork',
    meat_cut: 'Pork Hock',
    price_per_kg: 270.00,
    description: 'Front or hind pork shank packed with collagen, gelatin, and crackling potential.',
    image_url: 'https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?auto=format&fit=crop&w=600&q=80',
    stock_kg: 30.0
  },
  {
    category: 'Pork',
    name: 'Fresh Ground Pork',
    meat_type: 'Pork',
    meat_cut: 'Pork Ground Meat',
    price_per_kg: 250.00,
    description: 'Freshly minced pork, ideal for lumpia shanghai, giniling, and dumplings.',
    image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    stock_kg: 45.0
  },

  // ── CHICKEN CUTS ───────────────────────────────────────────────────
  {
    category: 'Chicken',
    name: 'Whole Dressed Chicken',
    meat_type: 'Chicken',
    meat_cut: 'Whole Chicken',
    price_per_kg: 190.00,
    description: 'Farm-fresh dressed whole chicken, cleaned and ready for roasting or tinola.',
    image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    stock_kg: 80.0
  },
  {
    category: 'Chicken',
    name: 'Boneless Skinless Chicken Breast',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Breast',
    price_per_kg: 240.00,
    description: 'High-protein, lean white meat fillets for meal prep, grilling, and salads.',
    image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    stock_kg: 65.0
  },
  {
    category: 'Chicken',
    name: 'Chicken Thigh Fillets',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Thigh',
    price_per_kg: 220.00,
    description: 'Juicy, rich dark meat chicken thighs, great for chicken teriyaki and inasal.',
    image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    stock_kg: 50.0
  },
  {
    category: 'Chicken',
    name: 'Chicken Quarter Legs',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Leg',
    price_per_kg: 210.00,
    description: 'Combined drumstick and thigh cut with skin on for roasting and frying.',
    image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    stock_kg: 55.0
  },
  {
    category: 'Chicken',
    name: 'Fresh Chicken Drumsticks',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Drumstick',
    price_per_kg: 215.00,
    description: 'Plump and tender drumsticks, the all-time favorite for crispy fried chicken.',
    image_url: 'https://images.unsplash.com/photo-1527477321055-43615852573d?auto=format&fit=crop&w=600&q=80',
    stock_kg: 60.0
  },
  {
    category: 'Chicken',
    name: 'Chicken Wings (3-Joint Cut)',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Wing',
    price_per_kg: 230.00,
    description: 'Fresh chicken wings with flat and drumette for Buffalo wings and Inasal.',
    image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 48.0
  },
  {
    category: 'Chicken',
    name: 'Fresh Chicken Liver',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Liver',
    price_per_kg: 160.00,
    description: 'Fresh nutrient-dense chicken liver for savory Adobong Atay and pate.',
    image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    stock_kg: 25.0
  },
  {
    category: 'Chicken',
    name: 'Cleaned Chicken Gizzard',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Gizzard',
    price_per_kg: 170.00,
    description: 'Thoroughly cleaned crunchy chicken gizzards for inihaw and spicy stir-fries.',
    image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    stock_kg: 20.0
  },
  {
    category: 'Chicken',
    name: 'Chicken Feet (Adidas Cut)',
    meat_type: 'Chicken',
    meat_cut: 'Chicken Feet',
    price_per_kg: 130.00,
    description: 'Cleaned, collagen-rich chicken feet for dim sum, barbecue, or savory stews.',
    image_url: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 35.0
  },

  // ── GOAT CUTS (CHEVON) ─────────────────────────────────────────────
  {
    category: 'Goat',
    name: 'Fresh Goat Leg (Kambing Pierna)',
    meat_type: 'Goat',
    meat_cut: 'Goat Leg',
    price_per_kg: 460.00,
    description: 'Meaty bone-in goat hind leg cut, the premier choice for Calderetang Kambing.',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 24.0
  },
  {
    category: 'Goat',
    name: 'Goat Shoulder Cut',
    meat_type: 'Goat',
    meat_cut: 'Goat Shoulder',
    price_per_kg: 420.00,
    description: 'Rich, flavorful goat shoulder with tender meat for slow-cooked stews and curry.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 28.0
  },
  {
    category: 'Goat',
    name: 'Goat Ribs & Flank',
    meat_type: 'Goat',
    meat_cut: 'Goat Ribs',
    price_per_kg: 440.00,
    description: 'Tender goat ribs cut into bite-sized pieces for Kaldereta or grilled Kilawin.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 18.0
  },
  {
    category: 'Goat',
    name: 'Goat Loin Chops',
    meat_type: 'Goat',
    meat_cut: 'Goat Chops',
    price_per_kg: 480.00,
    description: 'Tender T-bone shaped goat chops for pan-searing with herbs and garlic.',
    image_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    stock_kg: 15.0
  },
  {
    category: 'Goat',
    name: 'Goat Stew Cut / Cubes',
    meat_type: 'Goat',
    meat_cut: 'Goat Cubes',
    price_per_kg: 410.00,
    description: 'Uniform bite-sized goat cubes with bone and skin on for authentic Pinapaitan and Caldereta.',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 32.0
  },
  {
    category: 'Goat',
    name: 'Fresh Ground Goat Meat',
    meat_type: 'Goat',
    meat_cut: 'Goat Ground Meat',
    price_per_kg: 430.00,
    description: 'Lean ground chevon meat for kebabs, koftas, and Mediterranean dishes.',
    image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    stock_kg: 16.0
  },

  // ── RABBIT CUTS ────────────────────────────────────────────────────
  {
    category: 'Rabbit',
    name: 'Whole Farmed Dressed Rabbit',
    meat_type: 'Rabbit',
    meat_cut: 'Whole Rabbit',
    price_per_kg: 450.00,
    description: 'Cleaned whole rabbit meat, naturally low in cholesterol and high in lean protein.',
    image_url: 'https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=600&q=80',
    stock_kg: 22.0
  },
  {
    category: 'Rabbit',
    name: 'Rabbit Hind Legs',
    meat_type: 'Rabbit',
    meat_cut: 'Rabbit Legs',
    price_per_kg: 490.00,
    description: 'The meatiest part of the rabbit, excellent for braising in mustard or white wine sauce.',
    image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=80',
    stock_kg: 18.0
  },
  {
    category: 'Rabbit',
    name: 'Rabbit Loin Saddle Fillets',
    meat_type: 'Rabbit',
    meat_cut: 'Rabbit Loin',
    price_per_kg: 520.00,
    description: 'Delicate, ultra-tender rabbit loin fillets with mild, sweet flavor similar to chicken.',
    image_url: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
    stock_kg: 12.0
  },
  {
    category: 'Rabbit',
    name: 'Rabbit Stew Cut Pieces',
    meat_type: 'Rabbit',
    meat_cut: 'Rabbit Stew Cut',
    price_per_kg: 420.00,
    description: 'Portioned rabbit pieces on the bone, ideal for Adobong Kuneho and Spanish paella.',
    image_url: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=600&q=80',
    stock_kg: 25.0
  },
  {
    category: 'Rabbit',
    name: 'Fresh Ground Rabbit Meat',
    meat_type: 'Rabbit',
    meat_cut: 'Rabbit Ground Meat',
    price_per_kg: 460.00,
    description: 'Lean minced rabbit meat for gourmet burgers, meatballs, and diet-friendly fillings.',
    image_url: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=600&q=80',
    stock_kg: 14.0
  }
];

async function seed() {
  console.log('='.repeat(70));
  console.log('🥩 SEEDING MEAT CATEGORIES, PRODUCTS, AND INVENTORY');
  console.log('='.repeat(70));

  // 1. Ensure categories exist
  const catMap = {};
  for (const cat of CATEGORIES) {
    const existing = await query('SELECT id, name FROM categories WHERE name = ?', [cat.name]);
    if (existing.length > 0) {
      catMap[cat.name] = existing[0].id;
      console.log(`✅ Category exists: ${cat.name} (ID #${existing[0].id})`);
    } else {
      const res = await query(
        'INSERT INTO categories (name, description) VALUES (?, ?)',
        [cat.name, cat.description]
      );
      catMap[cat.name] = res.insertId;
      console.log(`✨ Created Category: ${cat.name} (ID #${res.insertId})`);
    }
  }

  // 2. Ensure supplier exists for inventory batches
  let supplierId = 1;
  const suppliers = await query('SELECT id FROM suppliers LIMIT 1');
  if (suppliers.length > 0) {
    supplierId = suppliers[0].id;
  } else {
    const supRes = await query(
      'INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES (?, ?, ?, ?, ?)',
      ['San Jose Livestock Farm', 'Mang Jose', 'sanjose@farm.local', '09171234567', 'Batangas, Philippines']
    );
    supplierId = supRes.insertId;
    console.log(`✨ Created Default Supplier ID #${supplierId}`);
  }

  // 3. Seed / Update Products and Inventory
  let seededProducts = 0;
  for (const item of PRODUCTS_DATA) {
    const catId = catMap[item.category];
    if (!catId) continue;

    // Check if product already exists by name
    const existing = await query('SELECT id FROM products WHERE name = ?', [item.name]);
    let prodId;

    if (existing.length > 0) {
      prodId = existing[0].id;
      await query(
        `UPDATE products SET 
          category_id = ?, meat_type = ?, meat_cut = ?, price_per_kg = ?, description = ?, image_url = ?, is_active = 1
         WHERE id = ?`,
        [catId, item.meat_type, item.meat_cut, item.price_per_kg, item.description, item.image_url, prodId]
      );
      console.log(`🔄 Updated product: ${item.name} (ID #${prodId})`);
    } else {
      const res = await query(
        `INSERT INTO products (category_id, name, meat_type, meat_cut, price_per_kg, description, image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [catId, item.name, item.meat_type, item.meat_cut, item.price_per_kg, item.description, item.image_url]
      );
      prodId = res.insertId;
      console.log(`✨ Created product: ${item.name} (ID #${prodId})`);
    }

    // Check inventory stock for this product
    const inv = await query(
      "SELECT id, available_stock_kg FROM inventory WHERE product_id = ? AND status IN ('available', 'low')",
      [prodId]
    );

    if (inv.length === 0) {
      const batchNo = `BATCH-${item.category.toUpperCase().slice(0, 3)}-${prodId}-${Math.floor(100 + Math.random() * 900)}`;
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + 30);

      await query(
        `INSERT INTO inventory (product_id, supplier_id, batch_no, weight_kg, available_stock_kg, price_per_kg, date_processed, expiration_date, status)
         VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, 'available')`,
        [prodId, supplierId, batchNo, item.stock_kg, item.stock_kg, item.price_per_kg, expDate.toISOString().slice(0, 10)]
      );
      console.log(`   📦 Seeded inventory batch ${batchNo}: ${item.stock_kg} kg`);
    }

    seededProducts++;
  }

  console.log('='.repeat(70));
  console.log(`🎉 COMPLETED! Seeded/Updated ${seededProducts} Meat Products with Inventory.`);
  console.log('='.repeat(70));
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
