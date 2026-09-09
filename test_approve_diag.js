// Diagnostic script - DELETE after debugging
require('dotenv').config({ path: './.env' });

const UserModel = require('./backend/models/userModel');
const { query } = require('./backend/config/db');
const jwt = require('jsonwebtoken');

async function testApprove() {
  try {
    console.log('Step 1: Pending registrations');
    const regs = await UserModel.getPendingRegistrations();
    console.log('Count:', regs.length);
    if (!regs.length) { console.log('None pending.'); process.exit(0); }
    const reg = regs[0];
    console.log('First reg:', JSON.stringify(reg));

    console.log('\nStep 2: Check email collision:', reg.email);
    const existingEmail = await UserModel.findByEmail(reg.email);
    console.log('Existing user with email:', existingEmail ? 'YES - COLLISION!' : 'None');
    if (existingEmail) { 
      console.log('Existing user data:', JSON.stringify(existingEmail));
      console.log('This would cause the 400 "An account with this email already exists" response.');
      process.exit(1); 
    }

    console.log('\nStep 3: Build username');
    let finalUsername = reg.username || 
      (reg.first_name.trim().toLowerCase() + '.' + reg.last_name.trim().toLowerCase()).replace(/[^a-z0-9.]/g, '');
    console.log('Username:', finalUsername);

    console.log('\nStep 4: Create user');
    const userId = await UserModel.createUser({
      first_name: reg.first_name, last_name: reg.last_name, username: finalUsername,
      email: reg.email, password: null, role: 'customer', is_active: 1, is_temp_password: 1
    });
    console.log('User created with ID:', userId);

    console.log('\nStep 5: Insert customer row');
    await query('INSERT INTO customers (user_id, phone, address, username) VALUES (?, ?, ?, ?)',
      [userId, reg.phone || null, reg.address || null, finalUsername]);
    console.log('Customer row inserted');

    console.log('\nStep 6: Update registration status to approved');
    await UserModel.updateRegistrationStatus(reg.id, 'approved');
    console.log('Status updated');

    console.log('\nStep 7: Sign JWT activation token');
    const user = await UserModel.findById(userId);
    const secret = process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash';
    const token = jwt.sign({ id: user.id, action: 'activation' }, secret, { expiresIn: '7d' });
    console.log('Token generated OK, first 40 chars:', token.substring(0, 40));

    console.log('\nStep 8: Send activation email');
    const { sendActivationEmail } = require('./backend/utils/emailService');
    const result = await sendActivationEmail(user.email, user.first_name, token);
    console.log('Email result:', JSON.stringify(result));

    console.log('\n✅ ALL STEPS PASSED - approval flow is working!');
    process.exit(0);
  } catch(err) {
    console.error('\n❌ FAILED at step:');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testApprove();
