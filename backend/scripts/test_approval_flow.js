const { query } = require('../config/db');

const API = 'http://localhost:5000/api';

async function runTests() {
  await query("DELETE FROM pending_registrations WHERE email LIKE 'test.applicant.%'");

  // Test 1: Query users via DB and API
  const usersDb = await query("SELECT id, username, email, status, is_active, temp_password_plain FROM users WHERE id IN (53, 54)");
  console.log('\n[TEST 1] DB check for #53 and #54:');
  console.table(usersDb);

  const pendingDb = await query("SELECT id, first_name, last_name, email, status FROM pending_registrations WHERE email IN ('james.cafra@smis.local', 'jed.madi@smis.local')");
  console.log('[TEST 1] pending_registrations for #53 and #54:');
  console.table(pendingDb);

  // Test 2: User list API check
  try {
    const userModel = require('../models/userModel');
    const allUsers = await userModel.getAllUsers();
    console.log(`\n[TEST 2] userModel.getAllUsers() count: ${allUsers.length}`);
    const found53 = allUsers.find(u => u.id === 53);
    const found54 = allUsers.find(u => u.id === 54);
    const foundPending = allUsers.filter(u => u.status === 'pending');
    console.log('Contains #53 in User Accounts?', Boolean(found53));
    console.log('Contains #54 in User Accounts?', Boolean(found54));
    console.log('Contains any status=pending?', foundPending.length > 0);

    const pendingList = await userModel.getPendingRegistrations();
    console.log(`\n[TEST 3] getPendingRegistrations() count: ${pendingList.length}`);
    console.log('Pending applicants in queue:', pendingList.map(p => ({ id: p.id, email: p.email, status: p.status })));
  } catch (err) {
    console.error('Error during model checks:', err);
  }

  // Test 4: Public registration test
  try {
    const testRegEmail = `test.applicant.${Date.now()}@smis.local`;
    console.log(`\n[TEST 4] Registering public applicant with email: ${testRegEmail}`);
    const regRes = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'Applicant',
        email: testRegEmail,
        phone: '09123456789',
        address: 'Test City, Bohol'
      })
    });
    const regData = await regRes.json();
    console.log('Registration response:', regData);

    // Verify DB state
    const createdPending = await query("SELECT * FROM pending_registrations WHERE email = ?", [testRegEmail]);
    console.log('Pending row exists in pending_registrations?', createdPending.length === 1);
    console.log('Pending row status:', createdPending[0]?.status);

    const createdUser = await query("SELECT * FROM users WHERE email = ?", [testRegEmail]);
    console.log('User created in users table before approval?', createdUser.length > 0 ? 'YES (UNEXPECTED)' : 'NO (CORRECT)');

    // Test 5: Login attempt with pending account
    console.log('\n[TEST 5] Attempting login with pending account email...');
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: testRegEmail,
        password: 'AnyPassword123!'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login HTTP status:', loginRes.status, 'Response message:', loginData.message);

    // Clean up test applicant
    await query("DELETE FROM pending_registrations WHERE email = ?", [testRegEmail]);
    console.log('Cleaned up test applicant.');
  } catch (err) {
    console.error('Registration test error:', err);
  }

  console.log('\n--- VERIFICATION TESTS COMPLETE ---');
  process.exit(0);
}

runTests();
