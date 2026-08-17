const UserModel = require('../models/userModel');
const generateToken = require('../utils/generateToken');
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

    const isMatch = await UserModel.comparePassword(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    const mustChangePassword = Boolean(user.is_temp_password);

    const userProfile = await UserModel.getProfile(user.id);
    const fullUser = userProfile || user;

    res.json({
      message: 'Login successful',
      token,
      must_change_password: mustChangePassword,
      user: {
        id: fullUser.id,
        first_name: fullUser.first_name,
        last_name: fullUser.last_name,
        username: fullUser.username,
        email: fullUser.email,
        role: fullUser.role,
        is_active: fullUser.is_active,
        is_temp_password: fullUser.is_temp_password,
        must_change_password: mustChangePassword,
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

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Please complete all required fields' });
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

    const userId = await UserModel.createUser({
      first_name,
      last_name,
      username: finalUsername,
      email,
      password,
      role: 'customer',
      is_active: 0,
      is_temp_password: 0
    });

    // Create linked customer profile row
    await query(
      'INSERT INTO customers (user_id, phone, address, username) VALUES (?, ?, ?, ?)',
      [userId, phone || null, address || null, finalUsername]
    );

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
        must_change_password: Boolean(user.is_temp_password)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getMe
};
