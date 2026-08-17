const http = require('http');

const BASE = 'http://localhost:5000/api';
const ADMIN_EMAIL = 'admin@smis.local';
const ADMIN_PASS = 'admin123';

function httpRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: rawData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testFullRoleFlow(roleName) {
  console.log('\n' + '='.repeat(70));
  console.log(`  STARTING COMPLETE WORKFLOW TEST FOR ROLE: ${roleName.toUpperCase()}`);
  console.log('='.repeat(70));

  const { query } = require('./db');
  const UserModel = require('../models/userModel');

  // 1. Admin login
  const adminLogin = await httpRequest('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  if (adminLogin.status !== 200) throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  const adminToken = adminLogin.data.token;
  console.log('1. Admin logged in successfully.');

  // 2. Register account
  const timestamp = Date.now();
  const testUser = {
    first_name: `Test${roleName}`,
    last_name: 'User',
    email: `test_${roleName}_${timestamp}@smis.local`,
    password: 'InitialPassword123!',
    phone: '09123456789'
  };

  const regRes = await httpRequest('POST', '/auth/register', testUser);
  if (regRes.status !== 201) throw new Error('Registration failed: ' + JSON.stringify(regRes.data));
  console.log(`2. Registered new ${roleName}. Message:`, regRes.data.message);

  // Find user by email
  const foundInDb = await UserModel.findByEmail(testUser.email);
  const registeredUsername = foundInDb.username;
  const registeredId = foundInDb.id;

  // 3. Attempt login while PENDING
  const pendingLogin = await httpRequest('POST', '/auth/login', {
    email: registeredUsername,
    password: 'InitialPassword123!'
  });
  console.log(`3. Attempted login while pending -> Status: ${pendingLogin.status}, Message: "${pendingLogin.data.message}"`);
  if (pendingLogin.status !== 403) throw new Error('Pending user was not rejected with 403!');

  // 4. Admin approves user
  const approveRes = await httpRequest('PATCH', `/users/${registeredId}/approve`, {}, adminToken);
  if (approveRes.status !== 200) throw new Error('Admin approval failed: ' + JSON.stringify(approveRes.data));
  console.log(`4. Admin approved ${roleName}:`, approveRes.data.message);

  // 5. Temporary password login test
  const KNOWN_TEMP_PASS = `TempPass_${timestamp}!`;
  await UserModel.activateWithTempPassword(registeredId, KNOWN_TEMP_PASS);
  console.log(`5. Temporary password set to: "${KNOWN_TEMP_PASS}"`);

  // 6. Login using Username + Temporary Password
  const tempLogin = await httpRequest('POST', '/auth/login', {
    email: registeredUsername,
    password: KNOWN_TEMP_PASS
  });
  if (tempLogin.status !== 200) throw new Error('Login with temporary password failed: ' + JSON.stringify(tempLogin.data));
  console.log('6. Login with Temporary Password SUCCESSFUL!');
  console.log('   - must_change_password:', tempLogin.data.must_change_password);
  console.log('   - role:', tempLogin.data.user.role);
  if (!tempLogin.data.must_change_password) throw new Error('must_change_password should be TRUE');

  const userToken = tempLogin.data.token;

  // 7. Change Password to permanent password
  const PERMANENT_PASS = `PermanentPass_${timestamp}#99`;
  const changeRes = await httpRequest('PUT', '/users/change-password', {
    current_password: KNOWN_TEMP_PASS,
    new_password: PERMANENT_PASS,
    confirm_password: PERMANENT_PASS
  }, userToken);
  if (changeRes.status !== 200) throw new Error('Change password failed: ' + JSON.stringify(changeRes.data));
  console.log('7. Password changed to permanent password successfully.');

  // 8. Login with permanent password
  const permLogin = await httpRequest('POST', '/auth/login', {
    email: registeredUsername,
    password: PERMANENT_PASS
  });
  if (permLogin.status !== 200) throw new Error('Login with permanent password failed: ' + JSON.stringify(permLogin.data));
  console.log('8. Login with Permanent Password SUCCESSFUL!');
  console.log('   - must_change_password:', permLogin.data.must_change_password);
  if (permLogin.data.must_change_password) throw new Error('must_change_password should now be FALSE');

  // Cleanup
  await query('DELETE FROM customers WHERE user_id = ?', [registeredId]);
  await query('DELETE FROM users WHERE id = ?', [registeredId]);
  console.log(`9. Cleaned up test user ID ${registeredId}.`);
  console.log(`✅ ${roleName.toUpperCase()} FULL FLOW TEST PASSED!\n`);
}

async function run() {
  try {
    await testFullRoleFlow('customer');
    console.log('====================================================');
    console.log('🎉 REGISTRATION & AUTHENTICATION FLOW VERIFIED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ TEST FAILURE:', err);
    process.exit(1);
  }
}

run();
