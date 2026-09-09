const { query } = require('./db');

const imageMap = {
  'Tenderloin': '/uploads/products/beef_tenderloin.jpg',
  'Sirloin': '/uploads/products/beef_sirloin.jpg',
  'Ribeye': '/uploads/products/beef_ribeye.jpg',
  'T-Bone': '/uploads/products/beef_tbone.jpg',
  'Striploin': '/uploads/products/beef_striploin.jpg',
  'Brisket': '/uploads/products/beef_brisket.jpg',
  'Chuck': '/uploads/products/beef_chuck.jpg',
  'Shank': '/uploads/products/beef_shank.jpg',
  'Short Ribs': '/uploads/products/beef_short_ribs.jpg',
  'Ground Meat': '/uploads/products/beef_ground.jpg',
  'Pork Belly': '/uploads/products/pork_belly.jpg',
  'Pork Chop': '/uploads/products/pork_chop.jpg',
  'Pork Loin': '/uploads/products/pork_loin.jpg',
};

async function updateImages() {
  const products = await query('SELECT id, meat_type, meat_cut FROM products');
  let count = 0;
  for (const p of products) {
    if (imageMap[p.meat_cut]) {
      await query('UPDATE products SET image_url = ? WHERE id = ?', [imageMap[p.meat_cut], p.id]);
      count++;
    } else {
      await query('UPDATE products SET image_url = NULL WHERE id = ?', [p.id]);
      count++;
    }
  }
  console.log(`Updated ${count} products.`);
  process.exit(0);
}

updateImages();
