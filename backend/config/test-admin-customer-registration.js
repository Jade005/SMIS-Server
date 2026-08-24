const http = require('http');
const { query } = require('./db');
const UserModel = require('../models/UserModel');
const jwt = require('jsonwebtoken');

function httpRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: `/api${path}`,
      method: method,
      headers: headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body);
        } catch (e) {}
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', err => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RBAC & CUSTOMER REGISTRATION TEST SUITE');
  console.log('================================================================\n');

  let adminToken = null;
  let cashierToken = null;
  let createdCustomerId = null;

  try {
    // 1. Authenticate as Admin
    console.log('1. Logging in as Admin...');
    const adminUser = await UserModel.findByUsername('admin');
    if (!adminUser) throw new Error('Admin user not found in DB');
    adminToken = jwt.sign(
      { id: adminUser.id, role: adminUser.role, email: adminUser.email },
      process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash',
      { expiresIn: '1h' }
    );
    console.log(`   ✅ Admin authenticated (ID: #${adminUser.id}).`);

    // 2. Obtain Cashier Token
    console.log('\n2. Obtaining Cashier Token...');
    const cashierUsers = await UserModel.getAllUsers({ role: 'cashier' });
    const cashierUser = cashierUsers[0];
    if (!cashierUser) throw new Error('Cashier user not found in DB');
    cashierToken = jwt.sign(
      { id: cashierUser.id, role: 'cashier', email: cashierUser.email },
      process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash',
      { expiresIn: '1h' }
    );
    console.log(`   ✅ Cashier token ready for User #${cashierUser.id} (${cashierUser.email}).`);

    // 3. Test: Cashier attempts to register customer (POST /users) -> Must return 403 Forbidden
    console.log('\n3. TEST: Cashier calls POST /users (Should return 403 Forbidden)...');
    const cashierAttemptRes = await httpRequest('POST', '/users', {
      first_name: 'CashierReg',
      last_name: 'Customer',
      email: 'cashier.test.cust@smis.local',
      role: 'customer'
    }, cashierToken);

    console.log(`   Response Status: ${cashierAttemptRes.status}`);
    console.log(`   Response Body:`, cashierAttemptRes.data);

    if (cashierAttemptRes.status === 403) {
      console.log('   ✅ PASS: Cashier role is correctly blocked with HTTP 403 Forbidden!');
    } else {
      throw new Error(`Expected HTTP 403 Forbidden, but got HTTP ${cashierAttemptRes.status}`);
    }

    // 4. Test: Admin registers customer with auto-filled credentials & auto-approval
    console.log('\n4. TEST: Admin calls POST /users to register customer...');
    const uniqueEmail = `test.customer.${Date.now()}@smis.local`;
    const adminRegRes = await httpRequest('POST', '/users', {
      first_name: 'Juan',
      last_name: 'Dela Cruz',
      email: uniqueEmail,
      role: 'customer',
      phone: '0917-123-4567',
      address: '123 Market St, Batangas'
    }, adminToken);

    console.log(`   Response Status: ${adminRegRes.status}`);
    console.log(`   Response Body:`, adminRegRes.data);

    if (adminRegRes.status === 201 && adminRegRes.data.user) {
      createdCustomerId = adminRegRes.data.user.id;
      console.log(`   ✅ PASS: Admin successfully registered customer User ID #${createdCustomerId}`);
    } else {
      throw new Error(`Failed to create customer as admin. Status: ${adminRegRes.status}`);
    }

    // 5. Verify Customer DB record (Active & linked customers table profile)
    console.log('\n5. Verifying Customer DB record and auto-approval state...');
    const dbCustomerUser = await UserModel.findById(createdCustomerId);
    const customerProfileRows = await query('SELECT * FROM customers WHERE user_id = ?', [createdCustomerId]);

    console.log(`   User Record: Role=${dbCustomerUser.role}, is_active=${dbCustomerUser.is_active}`);
    console.log(`   Customer Record: Phone=${customerProfileRows[0]?.phone}, Address=${customerProfileRows[0]?.address}`);

    if (dbCustomerUser.is_active === 1 && customerProfileRows.length > 0) {
      console.log('   ✅ PASS: Customer account is ACTIVE (auto-approved) with linked customer profile!');
    } else {
      throw new Error(`Customer verification failed in database.`);
    }

    // 6. Regression Check: Cashier read & POS operations
    console.log('\n6. Regression Check: Cashier POS & Inventory operations...');
    const invRes = await httpRequest('GET', '/inventory', null, cashierToken);
    const catRes = await httpRequest('GET', '/categories', null, cashierToken);
    const salesRes = await httpRequest('GET', '/sales', null, cashierToken);

    if (invRes.status === 200 && catRes.status === 200 && salesRes.status === 200) {
      console.log('   ✅ PASS: Cashier POS and inventory endpoints are fully operational.');
    } else {
      throw new Error('Regression failure on cashier endpoints.');
    }

    console.log('\n================================================================');
    console.log('🎉 ALL RESTORED TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');

  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    if (createdCustomerId) {
      await query('DELETE FROM customers WHERE user_id = ?', [createdCustomerId]);
      await query('DELETE FROM users WHERE id = ?', [createdCustomerId]);
      console.log(`🧹 Cleaned up test customer ID #${createdCustomerId}`);
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
