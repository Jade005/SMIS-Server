const CustomerModel = require('../models/customerModel');
const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');

const getProfile = async (req, res, next) => {
  try {
    const profile = await CustomerModel.getByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'Customer profile not found' });
    }
    res.json({ profile });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, username, email, contact_number, profile_image } = req.body;

    // Required fields validation
    if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
      return res.status(400).json({ message: 'First name and Last name are required.' });
    }

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    if (!contact_number || !contact_number.toString().trim()) {
      return res.status(400).json({ message: 'Contact number is required.' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }

    // Contact number digits only validation
    const phoneRegex = /^[0-9]+$/;
    const cleanContact = contact_number.toString().trim();
    if (!phoneRegex.test(cleanContact)) {
      return res.status(400).json({ message: 'Contact number must contain numbers only.' });
    }

    // Check unique username
    const existingUsername = await CustomerModel.findByUsername(username.trim(), userId);
    if (existingUsername) {
      return res.status(400).json({ message: 'Username is already taken by another account.' });
    }

    // Check unique email
    const existingEmail = await CustomerModel.findByEmail(email.trim(), userId);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email address is already registered to another account.' });
    }

    const updatedProfile = await CustomerModel.updateProfile(userId, {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      username: username.trim(),
      email: email.trim(),
      contact_number: cleanContact,
      profile_image: profile_image || null
    });

    res.json({
      message: 'Profile updated successfully',
      profile: updatedProfile
    });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'Please complete all password fields.' });
    }

    // Fetch user for current password_hash
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Query password_hash directly from users
    const { query } = require('../config/db');
    const userRows = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ message: 'User credentials not found' });
    }
    const currentHash = userRows[0].password_hash;

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, currentHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    // Password strength rules check
    if (new_password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    const hasUpper = /[A-Z]/.test(new_password);
    const hasLower = /[a-z]/.test(new_password);
    const hasNumber = /[0-9]/.test(new_password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(new_password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return res.status(400).json({
        message: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'Confirm password does not match new password.' });
    }

    // Hash new password using bcrypt
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(new_password, salt);

    await CustomerModel.updatePasswordHash(userId, newHash);

    res.json({
      message: 'Password updated successfully.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword
};
