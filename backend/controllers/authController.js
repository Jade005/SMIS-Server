const UserModel = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const { generateTemporaryPassword } = require('../utils/passwordHelper');
const { query } = require('../config/db');

// In-memory rate limiting map for failed login attempts
// Key: ip + ':' + identifier (normalized)
const failedAttemptsMap = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes lockout

const getRateLimitKey = (req, identifier) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const cleanId = (identifier || '').trim().toLowerCase();
  return `${ip}:${cleanId}`;
};

const checkRateLimit = (key) => {
  const record = failedAttemptsMap.get(key);
  if (!record) return { locked: false };

  const now = Date.now();
  if (now - record.firstAttemptTime > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.delete(key);
    return { locked: false };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const minutesLeft = Math.ceil((LOCKOUT_WINDOW_MS - (now - record.firstAttemptTime)) / 60000);
    return { locked: true, minutesLeft };
  }

  return { locked: false };
};

const recordFailedAttempt = (key) => {
  const now = Date.now();
  const record = failedAttemptsMap.get(key);
  if (!record || now - record.firstAttemptTime > LOCKOUT_WINDOW_MS) {
    failedAttemptsMap.set(key, { count: 1, firstAttemptTime: now });
  } else {
    record.count += 1;
    failedAttemptsMap.set(key, record);
  }
};

const clearFailedAttempts = (key) => {
  failedAttemptsMap.delete(key);
};

const login = async (req, res, next) => {
  try {
    const { email, username, identifier, password, portal } = req.body;
    const loginId = (email || username || identifier || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Please provide email/username and password' });
    }

    // 1. Rate limiting check (5 failed attempts per 15 mins)
    const rateLimitKey = getRateLimitKey(req, loginId);
    const rateStatus = checkRateLimit(rateLimitKey);
    if (rateStatus.locked) {
      return res.status(429).json({
        message: 'Too many failed login attempts. Please try again in 15 minutes.'
      });
    }

    // 2. Fetch user by username or email from database
    const user = await UserModel.findByUsernameOrEmail(loginId);

    // If user is not found in users table, check if there is a pending registration
    if (!user) {
      try {
        const pendingRows = await query(
          'SELECT id, status FROM pending_registrations WHERE email = ? OR username = ? ORDER BY created_at DESC LIMIT 1',
          [loginId, loginId]
        );
        if (pendingRows && pendingRows.length > 0) {
          if (pendingRows[0].status === 'pending') {
            recordFailedAttempt(rateLimitKey);
            return res.status(403).json({ message: 'Your account is waiting for admin approval.' });
          }
          if (pendingRows[0].status === 'rejected') {
            recordFailedAttempt(rateLimitKey);
            return res.status(403).json({ message: 'Your account request was rejected. Please contact the administrator.' });
          }
        }
      } catch (err) {
        // Silently continue if pending_registrations table check is unavailable
      }

      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check soft delete status
    if (user.deleted_at) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check status: only 'active' can log in
    if (user.status === 'pending') {
      recordFailedAttempt(rateLimitKey);
      return res.status(403).json({ message: 'Your account is waiting for admin approval.' });
    }

    if (user.status === 'rejected') {
      recordFailedAttempt(rateLimitKey);
      return res.status(403).json({ message: 'Your account request was rejected. Please contact the administrator.' });
    }

    // Check active status
    if (!user.is_active || user.status !== 'active') {
      recordFailedAttempt(rateLimitKey);
      if (user.role === 'customer') {
        return res.status(403).json({ message: 'Your account is waiting for admin approval.' });
      }
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the administrator.' });
    }

    // Check if account has not set password yet
    if (!user.password_hash) {
      recordFailedAttempt(rateLimitKey);
      return res.status(403).json({
        message: 'Your account is approved but you haven\'t set a password. Please check your email for the activation link to set your password.'
      });
    }

    // 3. Verify password
    const isMatch = await UserModel.comparePassword(password, user.password_hash);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 4. Role enforcement against selected portal
    // Database user.role is ground truth. Client-supplied body.role is ignored.
    if (portal) {
      const normalizedPortal = String(portal).trim().toLowerCase();
      const userRole = String(user.role || '').trim().toLowerCase();

      if (userRole !== normalizedPortal) {
        recordFailedAttempt(rateLimitKey);
        const portalLabels = {
          admin: 'Admin',
          cashier: 'Cashier',
          customer: 'Customer'
        };
        const portalLabel = portalLabels[normalizedPortal] || (normalizedPortal.charAt(0).toUpperCase() + normalizedPortal.slice(1));
        return res.status(403).json({
          message: `This account is not authorized for the ${portalLabel} portal. Please use the correct tab.`
        });
      }
    }

    // 5. Success: Clear any failed attempts record
    clearFailedAttempts(rateLimitKey);

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

    const cleanEmail = email.trim().toLowerCase();
    const existingEmail = await UserModel.findByEmail(cleanEmail);
    if (existingEmail) {
      if (existingEmail.status === 'pending') {
        return res.status(400).json({ message: 'Your account request was submitted. Please wait for admin approval.' });
      }
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
    const pendingQuery = await query('SELECT id FROM pending_registrations WHERE email = ? AND status = ?', [cleanEmail, 'pending']);
    if (pendingQuery.length > 0) {
      return res.status(400).json({ message: 'Your account request was submitted. Please wait for admin approval.' });
    }

    // Generate a default temporary password for the customer
    const cleanFirst = first_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanLast = last_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const tempPassword = `${cleanFirst}${cleanLast}123` || generateTemporaryPassword(10);

    // Save user account with status "pending" (is_active: 0)
    const userId = await UserModel.createUser({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      username: finalUsername,
      email: cleanEmail,
      password: tempPassword,
      role: 'customer',
      status: 'pending',
      is_active: 0,
      is_temp_password: 1,
      temp_password_plain: tempPassword
    });

    // Save into customers table with status "pending"
    await query(
      'INSERT INTO customers (user_id, phone, address, username, status) VALUES (?, ?, ?, ?, ?)',
      [userId, phone || null, address || null, finalUsername, 'pending']
    );

    // Also record in pending_registrations for admin queue compatibility
    await UserModel.createRegistration({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      username: finalUsername,
      email: cleanEmail,
      phone: phone || null,
      address: address || null
    });

    // Do NOT issue a token — account must be approved by admin first
    res.status(201).json({
      message: 'Your account request was submitted. Please wait for admin approval.',
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
