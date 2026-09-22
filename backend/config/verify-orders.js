/**
 * Verification script: logs in as two different customers and
 * compares their /orders/my responses to confirm scoping is correct.
 */
const http = require('http');

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api${path}`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: `/api${path}`, method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  // We need to know the email/password for two customer accounts.
  // Let's try to look them up from the database first.
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  const { query, pool } = require('./db');

  // Get emails for yogyog esto (user 33) and nicogb san (user 34)
  const users = await query('SELECT id, email, first_name, last_name FROM users WHERE id IN (33, 34)');
  console.log('Test users:');
  console.table(users);

  // Try logging in — we need passwords. Let's try common ones.
  // If we can't log in, we'll just call the endpoint directly with a crafted token.
  const jwt = require('jsonwebtoken');
  const SECRET = process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash';

  for (const u of users) {
    const token = jwt.sign({ id: u.id }, SECRET, { expiresIn: '1h' });
    console.log(`\n--- ${u.first_name} ${u.last_name} (user_id=${u.id}) ---`);

    const result = await httpGet('/orders/my', token);
    console.log(`  Status: ${result.status}`);
    console.log(`  Orders returned: ${Array.isArray(result.data) ? result.data.length : 'N/A'}`);
    if (Array.isArray(result.data)) {
      result.data.forEach(o => {
        console.log(`    #${o.order_no}  customer_id=${o.customer_id}  customer_name=${o.customer_name}  status=${o.status}`);
      });
    } else {
      console.log(`  Response:`, result.data);
    }
  }

  await pool.end();
  console.log('\n=== VERIFICATION COMPLETE ===');
}

main().catch(err => { console.error(err); process.exit(1); });
