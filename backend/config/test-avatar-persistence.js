const UserModel = require('../models/userModel');
const { saveAvatarImage } = require('../utils/avatarStorage');

async function testAvatarPersistence() {
  try {
    console.log('Testing Profile Picture Storage & Persistence...');

    // 1. Fetch default admin user (id: 1)
    const admin = await UserModel.findById(1);
    if (!admin) {
      console.log('Admin account (id 1) not found, finding first available user...');
    }
    const targetUser = admin || (await UserModel.getAllUsers())[0];
    console.log(`Targeting user #${targetUser.id} (${targetUser.first_name} ${targetUser.last_name}, Role: ${targetUser.role})`);

    // 2. Simulate Base64 image payload (PNG 1x1 pixel)
    const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // 3. Save avatar image to disk using avatarStorage
    const savedPath = saveAvatarImage(mockBase64, targetUser.id);
    console.log('✅ Image saved to server storage path:', savedPath);

    // 4. Update user database record
    await UserModel.updateProfilePicture(targetUser.id, savedPath);
    console.log('✅ Database profile_picture updated.');

    // 5. Simulate login / /auth/me fetch from database
    const fetchedUser = await UserModel.findById(targetUser.id);
    console.log('✅ Retrieved profile_picture from DB on login query:', fetchedUser.profile_picture);

    if (fetchedUser.profile_picture === savedPath) {
      console.log('🎉 Profile Picture Upload & Persistence Test PASSED SUCCESSFULLY!');
      process.exit(0);
    } else {
      console.error('❌ Mismatch in saved vs fetched profile picture path!');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testAvatarPersistence();
