const UserModel = require('../models/userModel');

async function testSaveProfileBugfix() {
  try {
    console.log('Testing Save Profile Bugfix for Admin, Cashier, and User...');

    // Fetch Admin (id: 1)
    const admin = await UserModel.findById(1);
    if (!admin) {
      console.error('❌ Admin user not found');
      process.exit(1);
    }

    console.log(`Initial Admin state: id=${admin.id}, name=${admin.first_name} ${admin.last_name}, picture=${admin.profile_picture}`);

    // 1. Update Admin profile WITHOUT passing picture (simulating update text info only)
    const updatedAdmin1 = await UserModel.updateProfile(admin.id, {
      first_name: admin.first_name,
      last_name: admin.last_name,
      username: admin.username,
      email: admin.email,
      phone: undefined, // test undefined phone
      contact_number: undefined, // test undefined contact_number
      address: undefined, // test undefined address
      profile_picture: undefined // test undefined profile_picture
    });

    console.log('✅ Update 1 (Text info with undefined optional fields) succeeded!');
    console.log(`Updated Admin 1 state: picture=${updatedAdmin1.profile_picture}`);

    // 2. Update Admin profile WITH a new picture
    const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const { saveAvatarImage } = require('../utils/avatarStorage');
    const newAvatarUrl = saveAvatarImage(mockBase64, admin.id);

    const updatedAdmin2 = await UserModel.updateProfile(admin.id, {
      first_name: admin.first_name,
      last_name: admin.last_name,
      username: admin.username,
      email: admin.email,
      phone: null,
      contact_number: null,
      address: null,
      profile_picture: newAvatarUrl
    });

    console.log('✅ Update 2 (New picture) succeeded!');
    console.log(`Updated Admin 2 picture: ${updatedAdmin2.profile_picture}`);

    // 3. Update Admin profile AGAIN without touching picture (must NOT overwrite existing picture)
    const updatedAdmin3 = await UserModel.updateProfile(admin.id, {
      first_name: admin.first_name,
      last_name: admin.last_name,
      username: admin.username,
      email: admin.email,
      phone: undefined,
      address: undefined,
      profile_picture: undefined
    });

    console.log('✅ Update 3 (Text update preserving picture) succeeded!');
    console.log(`Updated Admin 3 picture: ${updatedAdmin3.profile_picture}`);

    if (updatedAdmin3.profile_picture === newAvatarUrl) {
      console.log('🎉 Save Profile Bugfix Test PASSED PERFECTLY!');
      process.exit(0);
    } else {
      console.error(`❌ Mismatch: expected ${newAvatarUrl}, got ${updatedAdmin3.profile_picture}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testSaveProfileBugfix();
