const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'smis_jwt_secret_key_2026_super_secure_hash'
      );

      const users = await query(
        'SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = ?',
        [decoded.id]
      );

      if (!users || users.length === 0) {
        return res.status(401).json({ message: 'User not found' });
      }

      if (!users[0].is_active) {
        return res.status(403).json({ message: 'User account is deactivated' });
      }

      req.user = users[0];
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

module.exports = { protect };
