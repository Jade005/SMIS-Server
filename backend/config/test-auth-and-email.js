const { generateTemporaryPassword } = require('../utils/passwordHelper');
const { sendAccountCredentialsEmail } = require('../utils/emailService');
const UserModel = require('../models/userModel');

async function testFeature() {
  try {
    console.log('Testing Password Generator...');
    const tempPass = generateTemporaryPassword(12);
    console.log('✅ Generated Temp Password:', tempPass);

    console.log('Testing Email Service Fallback...');
    const emailResult = await sendAccountCredentialsEmail({
      email: 'testuser@smis.local',
      fullName: 'Test Cashier',
      username: 'test.cashier',
      tempPassword: tempPass,
      isReset: false
    });
    console.log('✅ Email Service Result:', emailResult);

    console.log('🎉 Feature modules verified successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

testFeature();
