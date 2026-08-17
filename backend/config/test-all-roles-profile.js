const UserModel = require('../models/userModel');
const CustomerModel = require('../models/customerModel');
const { saveAvatarImage } = require('../utils/avatarStorage');

async function testAllRolesProfile() {
  try {
    console.log('--------------------------------------------------');
    console.log('Testing Profile & Avatar Saving for ALL Roles');
    console.log('--------------------------------------------------');

    const allUsers = await UserModel.getAllUsers();
    console.log(`Found ${allUsers.length} total users in database.`);

    const rolesToTest = ['admin', 'cashier', 'customer'];

    for (const role of rolesToTest) {
      let targetUser = allUsers.find(u => u.role === role);

      if (!targetUser) {
        console.log(`No existing user with role '${role}' found, creating test account...`);
        const tempId = await UserModel.createUser({
          first_name: `Test_${role}`,
          last_name: 'Account',
          username: `test_${role}_${Date.now()}`,
          email: `test_${role}_${Date.now()}@smis.com`,
          password: 'TestPassword123!',
          role: role,
          is_active: 1
        });
        targetUser = await UserModel.findById(tempId);
      }

      console.log(`\n Testing Role: '${role.toUpperCase()}' (ID: ${targetUser.id}, Name: ${targetUser.first_name} ${targetUser.last_name})`);

      // Test 1: Update text details without picture (check no bind undefined error)
      const updatedText = await UserModel.updateProfile(targetUser.id, {
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
        username: targetUser.username || `user_${targetUser.id}`,
        email: targetUser.email,
        contact_number: '09123456789',
        address: '123 Test Street',
        profile_picture: undefined // Should NOT wipe out existing picture
      });
      console.log(`   ✅ [1/2] Text profile update succeeded for ${role}! Contact: ${updatedText.contact_number || updatedText.phone}`);

      // Test 2: Update picture with mock base64 image
      const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const savedPath = saveAvatarImage(mockBase64, targetUser.id);
      
      const updatedPic = await UserModel.updateProfile(targetUser.id, {
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
        username: targetUser.username || `user_${targetUser.id}`,
        email: targetUser.email,
        contact_number: '09123456789',
        profile_picture: savedPath
      });

      console.log(`   ✅ [2/2] Profile picture update succeeded for ${role}! Saved avatar path: ${updatedPic.profile_picture}`);

      // Test 3: Fetch profile again to verify persistence
      const persisted = await UserModel.getProfile(targetUser.id);
      if (persisted.profile_picture === savedPath) {
        console.log(`   🎉 Role '${role}' profile & avatar persistence VERIFIED!`);
      } else {
        throw new Error(`Profile picture persistence failed for role ${role}: expected ${savedPath}, got ${persisted.profile_picture}`);
      }
    }

    console.log('\n==================================================');
    console.log('🎉 ALL ROLE PROFILE & AVATAR TESTS PASSED 100%!');
    console.log('==================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test failed with error:', err);
    process.exit(1);
  }
}

testAllRolesProfile();
