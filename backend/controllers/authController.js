const UserModel = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const { generateTemporaryPassword } = require('../utils/passwordHelper');
const { query } = require('../config/db');

const login = async (req, res, next) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginId = email || username || identifier;

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    const user = await UserModel.findByUsernameOrEmail(loginId);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ message: 'Your account is pending admin approval. Please wait for an administrator to approve your account before logging in.' });
    }

    if (!user.password_hash) {
      return res.status(403).json({ message: 'Your account is approved but you haven\'t set a password. Please check your email for the activation link to set your password.' });
    }

    const isMatch = await UserModel.comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);

    const userProfile = await UserModel.getProfile(user.id);
    const fullUser = userProfile || user;

    res.json({
      message: 'Login successful',
      token,
      must_change_password: false,
      user: {
        id: fullUser.id,
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        username: fullUser.username,
        email: fullUser.email,
        role: fullUser.role,
        is_active: fullUser.is_active,
        is_temp_password: fullUser.is_temp_password,
        must_change_password: false,
        profile_picture: fullUser.profile_picture || fullUser.profile_image || null,
        profile_image: fullUser.profile_picture || fullUser.profile_image || null,
        contact_number: fullUser.contact_number || fullUser.phone || null,
        address: fullUser.address || null
      }
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { first_name, last_name, username, email, password, phone, address } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: 'First name, last name, and email address are required.' });
    }

    const existingEmail = await UserModel.findByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    let finalUsername = username ? username.trim() : `${first_name.trim().toLowerCase()}.${last_name.trim().toLowerCase()}`.replace(/[^a-z0-9.]/g, '');

    const existingUser = await UserModel.findByUsername(finalUsername);
    if (existingUser) {
      if (username) {
        return res.status(400).json({ message: 'Username is already taken' });
      } else {
        finalUsername = `${finalUsername}${Math.floor(100 + Math.random() * 900)}`;
      }
    }

    // Check if the email exists in pending_registrations too
    const pendingQuery = await query('SELECT id FROM pending_registrations WHERE email = ? AND status = ?', [email, 'pending']);
    if (pendingQuery.length > 0) {
      return res.status(400).json({ message: 'An application with this email is already pending approval.' });
    }

    const registrationId = await UserModel.createRegistration({
      first_name,
      last_name,
      username: finalUsername,
      email,
      phone: phone || null,
      address: address || null
    });

    // Do NOT issue a token — account must be approved by admin first
    res.status(201).json({
      message: 'Registration submitted! Your account is pending admin approval. You will be able to log in once an administrator approves your account.',
      pending: true
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const userProfile = await UserModel.getProfile(req.user.id);
    const user = userProfile || req.user;

    res.json({
      user: {
        ...user,
        profile_picture: user.profile_picture || user.profile_image || null,
        profile_image: user.profile_picture || user.profile_image || null,
        must_change_password: false
      }
    });
  } catch (error) {
    next(error);
  }
};

const setPassword = async (req, res, next) => {
  try {
    const { token, new_password, confirm_password } = req.body;

    if (!token || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'Please provide the token, new password, and confirm password.' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

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

    // Verify token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash');
    } catch (err) {
      return res.status(400).json({ message: 'Invalid or expired activation token.' });
    }

    if (decoded.action !== 'activation') {
      return res.status(400).json({ message: 'Invalid token type.' });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Hash new password using bcrypt
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(new_password, salt);

    // Update password_hash and set is_temp_password to 0
    await query('UPDATE users SET password_hash = ?, is_temp_password = 0, temp_password_plain = NULL WHERE id = ?', [newHash, user.id]);

    res.json({ message: 'Password has been set successfully. You can now log in.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getMe,
  setPassword
};
