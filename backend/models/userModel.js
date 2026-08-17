const { query } = require('../config/db');
const bcrypt = require('bcryptjs');

const UserModel = {
  async findByEmail(email) {
    const users = await query('SELECT id, first_name, last_name, username, email, password_hash, role, is_active, is_temp_password, profile_picture, created_at, updated_at FROM users WHERE email = ?', [email ?? null]);
    return users[0] || null;
  },

  async findByUsername(username) {
    if (!username) return null;
    const users = await query('SELECT id, first_name, last_name, username, email, password_hash, role, is_active, is_temp_password, profile_picture, created_at, updated_at FROM users WHERE username = ?', [username ?? null]);
    return users[0] || null;
  },

  async findByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const cleanId = identifier ?? null;
    const users = await query(
      'SELECT id, first_name, last_name, username, email, password_hash, role, is_active, is_temp_password, profile_picture, created_at, updated_at FROM users WHERE email = ? OR username = ?',
      [cleanId, cleanId]
    );
    return users[0] || null;
  },

  async findById(id) {
    const users = await query(
      'SELECT id, first_name, last_name, username, email, role, is_active, is_temp_password, profile_picture, created_at, updated_at FROM users WHERE id = ?',
      [id ?? null]
    );
    return users[0] || null;
  },

  async getAllUsers(filters = {}) {
    let sql = 'SELECT id, first_name, last_name, username, email, role, is_active, is_temp_password, profile_picture, created_at FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      sql += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active);
    }

    sql += ' ORDER BY created_at DESC';
    return await query(sql, params);
  },

  async createUser({ first_name, last_name, username, email, password, role = 'customer', is_active, is_temp_password = 0, profile_picture = null }) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    const active = is_active !== undefined ? (is_active ? 1 : 0) : (role === 'customer' ? 0 : 1);
    const tempPassFlag = is_temp_password ? 1 : 0;

    const result = await query(
      'INSERT INTO users (first_name, last_name, username, email, password_hash, role, is_active, is_temp_password, profile_picture) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        first_name ?? null,
        last_name ?? null,
        username ?? null,
        email ?? null,
        password_hash,
        role,
        active,
        tempPassFlag,
        profile_picture ?? null
      ]
    );

    return result.insertId;
  },

  async updateUser(id, { first_name, last_name, username, email, role, profile_picture }) {
    const currentUser = await this.findById(id);
    let finalPicture = currentUser ? currentUser.profile_picture : null;
    if (profile_picture !== undefined) {
      finalPicture = profile_picture ? profile_picture : null;
    }

    await query(
      'UPDATE users SET first_name = ?, last_name = ?, username = ?, email = ?, role = ?, profile_picture = ? WHERE id = ?',
      [
        first_name ?? null,
        last_name ?? null,
        username ?? null,
        email ?? null,
        role ?? 'customer',
        finalPicture,
        id
      ]
    );
    return this.findById(id);
  },

  async updatePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = ?, is_temp_password = 0 WHERE id = ?', [password_hash, id]);
    return true;
  },

  async resetPasswordWithTemp(id, tempPassword) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(tempPassword, salt);

    await query('UPDATE users SET password_hash = ?, is_temp_password = 1 WHERE id = ?', [password_hash, id]);
    return true;
  },

  async toggleStatus(id, is_active) {
    await query('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
    return this.findById(id);
  },

  async getPendingUsers() {
    return await query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.role, u.is_active, u.is_temp_password, u.profile_picture, u.created_at,
              c.phone, c.address
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.role = 'customer' AND u.is_active = 0
       ORDER BY u.created_at DESC`
    );
  },

  async approveUser(id) {
    await query('UPDATE users SET is_active = 1 WHERE id = ? AND role = \'customer\'', [id]);
    return this.findById(id);
  },

  async comparePassword(candidatePassword, passwordHash) {
    return await bcrypt.compare(candidatePassword, passwordHash);
  },

  async getProfile(userId) {
    const rows = await query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.role, u.is_active, u.is_temp_password,
              COALESCE(u.profile_picture, c.profile_image) AS profile_picture,
              COALESCE(c.profile_image, u.profile_picture) AS profile_image,
              u.created_at,
              c.phone, c.contact_number, c.address
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async updateProfile(userId, { first_name, last_name, username, email, phone, contact_number, address, profile_picture }) {
    const cleanFirstName = first_name ?? null;
    const cleanLastName = last_name ?? null;
    const cleanUsername = username ?? null;
    const cleanEmail = email ?? null;
    const cleanPhone = (contact_number || phone) ?? null;
    const cleanAddress = address ?? null;

    // Fetch existing user to preserve profile_picture if profile_picture is undefined
    const currentUser = await this.findById(userId);
    let finalProfilePicture = currentUser ? currentUser.profile_picture : null;
    
    if (profile_picture !== undefined) {
      finalProfilePicture = profile_picture ? profile_picture : null;
    }

    await query(
      'UPDATE users SET first_name = ?, last_name = ?, email = ?, username = ?, profile_picture = ? WHERE id = ?',
      [cleanFirstName, cleanLastName, cleanEmail, cleanUsername, finalProfilePicture, userId]
    );

    const existingCust = await query('SELECT id FROM customers WHERE user_id = ?', [userId]);
    if (existingCust.length > 0) {
      await query(
        'UPDATE customers SET phone = ?, contact_number = ?, address = ?, profile_image = ?, username = ? WHERE user_id = ?',
        [cleanPhone, cleanPhone, cleanAddress, finalProfilePicture, cleanUsername, userId]
      );
    } else if (currentUser && currentUser.role === 'customer' && (cleanPhone || cleanAddress)) {
      await query(
        'INSERT INTO customers (user_id, phone, contact_number, address, profile_image, username) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, cleanPhone, cleanPhone, cleanAddress, finalProfilePicture, cleanUsername]
      );
    }

    return this.getProfile(userId);
  },

  async updateProfilePicture(userId, profile_picture) {
    const cleanPic = profile_picture ?? null;
    await query('UPDATE users SET profile_picture = ? WHERE id = ?', [cleanPic, userId]);
    
    const existingCust = await query('SELECT id FROM customers WHERE user_id = ?', [userId]);
    if (existingCust.length > 0) {
      await query('UPDATE customers SET profile_image = ? WHERE user_id = ?', [cleanPic, userId]);
    }
    return this.getProfile(userId);
  }
};

module.exports = UserModel;
