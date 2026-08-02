const UserModel = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const { query } = require('../config/db');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await UserModel.findByEmail(email);

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

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone, address } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ message: 'Please complete all required fields' });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    const userId = await UserModel.createUser({
      first_name,
      last_name,
      email,
      password,
      role: 'customer'
      // is_active defaults to 0 (pending approval) for customers in userModel
    });

    // Create linked customer profile row
    await query(
      'INSERT INTO customers (user_id, phone, address) VALUES (?, ?, ?)',
      [userId, phone || null, address || null]
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
    res.json({ user: req.user });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  register,
  getMe
};
