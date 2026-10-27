const { query } = require('../config/db');
const bcrypt = require('bcryptjs');
const { getMiddleInitial } = require('../utils/nameHelper');

const UserModel = {
  async findByEmail(email) {
    const users = await query('SELECT id, first_name, middle_name, middle_initial, last_name, username, email, password_hash, role, status, is_active, is_temp_password, temp_password_plain, profile_picture, created_at, updated_at FROM users WHERE email = ?', [email ?? null]);
    return users[0] || null;
  },

  async findByUsername(username) {
    if (!username) return null;
    const users = await query('SELECT id, first_name, middle_name, middle_initial, last_name, username, email, password_hash, role, status, is_active, is_temp_password, temp_password_plain, profile_picture, created_at, updated_at FROM users WHERE username = ?', [username ?? null]);
    return users[0] || null;
  },

  async findByEmailExcludeId(email, excludeId) {
    if (!email) return null;
    const users = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, excludeId]);
    return users[0] || null;
  },

  async findByUsernameExcludeId(username, excludeId) {
    if (!username) return null;
    const users = await query('SELECT id FROM users WHERE username = ? AND id != ?', [username, excludeId]);
    return users[0] || null;
  },

  async findByUsernameOrEmail(identifier) {
    if (!identifier) return null;
    const cleanId = identifier ?? null;
    const users = await query(
      'SELECT id, first_name, middle_name, middle_initial, last_name, username, email, password_hash, role, status, is_active, is_temp_password, temp_password_plain, profile_picture, created_at, updated_at FROM users WHERE email = ? OR username = ?',
      [cleanId, cleanId]
    );
    return users[0] || null;
  },

  async findById(id) {
    const users = await query(
      'SELECT id, first_name, middle_name, middle_initial, last_name, username, email, role, status, is_active, is_temp_password, temp_password_plain, profile_picture, registered_by, created_by_admin_id, created_at, updated_at FROM users WHERE id = ?',
      [id ?? null]
    );
    return users[0] || null;
  },

  async getAllUsers(filters = {}) {
    const includeTemp = Boolean(filters.isAdmin);
    let sql = `
      SELECT id, first_name, middle_name, middle_initial, last_name, username, email,
             role, status, is_active, is_temp_password, ${includeTemp ? 'temp_password_plain,' : ''} profile_picture,
             registered_by, created_by_admin_id, created_at, updated_at
      FROM users
      WHERE deleted_at IS NULL
        AND status NOT IN ('pending', 'rejected')
    `;
    const params = [];

    if (filters.role) {
      sql += ' AND role = ?';
      params.push(filters.role);
    }

    if (filters.status) {
      if (filters.status === 'active') {
        sql += ' AND (status = \'active\' AND is_active = 1)';
      } else if (filters.status === 'deactivated' || filters.status === 'inactive') {
        sql += ' AND (status = \'deactivated\' OR is_active = 0)';
      } else {
        sql += ' AND status = ?';
        params.push(filters.status);
      }
    }

    if (filters.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(filters.is_active ? 1 : 0);
    }

    sql += ' ORDER BY created_at DESC';
    return await query(sql, params);
  },

  async createUser({
    first_name,
    middle_name = null,
    middle_initial = null,
    last_name,
    username,
    email,
    password,
    role = 'customer',
    status,
    is_active,
    is_temp_password = 0,
    temp_password_plain = null,
    profile_picture = null,
    registered_by = null,
    created_by_admin_id = null
  }) {
    let password_hash = null;
    if (password) {
      const salt = await bcrypt.genSalt(12);
      password_hash = await bcrypt.hash(password, salt);
    }

    const calculatedMi = middle_initial || (middle_name ? getMiddleInitial(middle_name) : null);
    const accountStatus = status || (role === 'customer' ? 'pending' : 'active');
    const active = is_active !== undefined
      ? (is_active ? 1 : 0)
      : (accountStatus === 'active' ? 1 : 0);
    const tempPassFlag = is_temp_password ? 1 : 0;
    const adminCreator = created_by_admin_id || registered_by || null;

    const result = await query(
      'INSERT INTO users (first_name, middle_name, middle_initial, last_name, username, email, password_hash, role, status, is_active, is_temp_password, temp_password_plain, profile_picture, registered_by, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)',
      [
        first_name ?? null,
        middle_name ?? null,
        calculatedMi ?? null,
        last_name ?? null,
        username ?? null,
        email ?? null,
        password_hash,
        role,
        accountStatus,
        active,
        tempPassFlag,
        profile_picture ?? null,
        adminCreator,
        adminCreator
      ]
    );

    return result.insertId;
  },

  async updateUser(id, { first_name, middle_name, middle_initial, last_name, username, email, role, is_active, password, profile_picture }) {
    const currentUser = await this.findById(id);
    if (!currentUser) return null;

    let finalPicture = currentUser.profile_picture;
    if (profile_picture !== undefined) {
      finalPicture = profile_picture ? profile_picture : null;
    }

    const updates = [];
    const params = [];

    if (first_name !== undefined) { updates.push('first_name = ?'); params.push(first_name); }
    if (middle_name !== undefined) {
      const cleanMn = middle_name ? String(middle_name).trim() : null;
      const cleanMi = middle_initial !== undefined
        ? (middle_initial ? String(middle_initial).trim() : null)
        : (cleanMn ? getMiddleInitial(cleanMn) : null);
      updates.push('middle_name = ?'); params.push(cleanMn);
      updates.push('middle_initial = ?'); params.push(cleanMi);
    } else if (middle_initial !== undefined) {
      updates.push('middle_initial = ?'); params.push(middle_initial ? String(middle_initial).trim() : null);
    }
    if (last_name !== undefined) { updates.push('last_name = ?'); params.push(last_name); }
    if (username !== undefined) { updates.push('username = ?'); params.push(username); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (profile_picture !== undefined) { updates.push('profile_picture = ?'); params.push(finalPicture); }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (middle_name !== undefined) {
      try {
        const cleanMn = middle_name ? String(middle_name).trim() : null;
        const cleanMi = cleanMn ? getMiddleInitial(cleanMn) : null;
        await query('UPDATE customers SET middle_name = ?, middle_initial = ? WHERE user_id = ?', [cleanMn, cleanMi, id]);
      } catch (e) {
        // customers table may not have matching row or column, ignore
      }
    }

    if (username !== undefined) {
      try {
        await query('UPDATE customers SET username = ? WHERE user_id = ?', [username, id]);
      } catch (e) {
        // customers table may not have matching row or column, ignore
      }
    }

    return this.findById(id);
  },

  async updatePassword(id, newPassword) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = ?, is_temp_password = 0, temp_password_plain = NULL WHERE id = ?', [password_hash, id]);
    return true;
  },

  async resetPasswordWithTemp(id, tempPassword) {
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(tempPassword, salt);

    await query('UPDATE users SET password_hash = ?, is_temp_password = 1, temp_password_plain = NULL WHERE id = ?', [password_hash, id]);
    return true;
  },

  async toggleStatus(id, is_active) {
    const newStatus = is_active ? 'active' : 'deactivated';
    await query('UPDATE users SET is_active = ?, status = ?, updated_at = NOW() WHERE id = ?', [is_active ? 1 : 0, newStatus, id]);
    await query('UPDATE customers SET status = ?, updated_at = NOW() WHERE user_id = ?', [newStatus, id]);
    return this.findById(id);
  },

  async deactivateUser(id) {
    await query("UPDATE users SET is_active = 0, status = 'deactivated', updated_at = NOW() WHERE id = ?", [id]);
    await query("UPDATE customers SET status = 'deactivated', updated_at = NOW() WHERE user_id = ?", [id]);
    return this.findById(id);
  },

  async activateUser(id) {
    await query("UPDATE users SET is_active = 1, status = 'active', updated_at = NOW() WHERE id = ?", [id]);
    await query("UPDATE customers SET status = 'active', updated_at = NOW() WHERE user_id = ?", [id]);
    return this.findById(id);
  },

  async countActiveAdmins() {
    const rows = await query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND deleted_at IS NULL");
    return Number(rows[0]?.count || 0);
  },

  async hasRelatedRecords(userId) {
    // 1. Check if user is cashier in sales
    const salesCashier = await query('SELECT COUNT(*) AS count FROM sales WHERE cashier_id = ?', [userId]);
    if (salesCashier[0]?.count > 0) return true;

    // 2. Check customer records (orders and customer sales)
    const custRows = await query('SELECT id FROM customers WHERE user_id = ?', [userId]);
    if (custRows.length > 0) {
      const custId = custRows[0].id;
      const custOrders = await query('SELECT COUNT(*) AS count FROM orders WHERE customer_id = ?', [custId]);
      if (custOrders[0]?.count > 0) return true;

      const custSales = await query('SELECT COUNT(*) AS count FROM sales WHERE customer_id = ?', [custId]);
      if (custSales[0]?.count > 0) return true;
    }

    return false;
  },

  async deleteUser(id) {
    // Delete linked empty customer row if exists
    try {
      await query('DELETE FROM customers WHERE user_id = ?', [id]);
    } catch (e) {
      // Ignore if foreign key constraint or non-existent
    }

    // Attempt hard delete first
    try {
      await query('DELETE FROM users WHERE id = ?', [id]);
      return { hardDeleted: true };
    } catch (err) {
      // If foreign key constraint prevents hard delete, soft delete
      await query('UPDATE users SET deleted_at = NOW(), is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
      return { hardDeleted: false };
    }
  },

  async getPendingUsers() {
    return await query(
      `SELECT u.id, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.username, u.email, u.role, u.is_active, u.is_temp_password, u.temp_password_plain, u.profile_picture, u.created_at,
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
      `SELECT u.id, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.username, u.email, u.role, u.is_active, u.is_temp_password,
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

  async updateProfile(userId, { first_name, middle_name, middle_initial, last_name, username, email, phone, contact_number, address, profile_picture }) {
    const cleanFirstName = first_name ?? null;
    const cleanLastName = last_name ?? null;
    const cleanMiddleName = middle_name !== undefined ? (middle_name ? String(middle_name).trim() : null) : undefined;
    const cleanMiddleInitial = middle_initial !== undefined
      ? (middle_initial ? String(middle_initial).trim() : null)
      : (cleanMiddleName ? getMiddleInitial(cleanMiddleName) : (cleanMiddleName === null ? null : undefined));
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

    const updates = ['first_name = ?', 'last_name = ?', 'email = ?', 'username = ?', 'profile_picture = ?'];
    const params = [cleanFirstName, cleanLastName, cleanEmail, cleanUsername, finalProfilePicture];

    if (cleanMiddleName !== undefined) {
      updates.push('middle_name = ?');
      params.push(cleanMiddleName);
      updates.push('middle_initial = ?');
      params.push(cleanMiddleInitial ?? null);
    }

    params.push(userId);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const existingCust = await query('SELECT id FROM customers WHERE user_id = ?', [userId]);
    if (existingCust.length > 0) {
      const custUpdates = ['phone = ?', 'contact_number = ?', 'address = ?, profile_image = ?, username = ?'];
      const custParams = [cleanPhone, cleanPhone, cleanAddress, finalProfilePicture, cleanUsername];
      if (cleanMiddleName !== undefined) {
        custUpdates.push('middle_name = ?', 'middle_initial = ?');
        custParams.push(cleanMiddleName, cleanMiddleInitial ?? null);
      }
      custParams.push(userId);
      await query(
        `UPDATE customers SET ${custUpdates.join(', ')} WHERE user_id = ?`,
        custParams
      );
    } else if (currentUser && currentUser.role === 'customer' && (cleanPhone || cleanAddress || cleanMiddleName !== undefined)) {
      await query(
        'INSERT INTO customers (user_id, middle_name, middle_initial, phone, contact_number, address, profile_image, username) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, cleanMiddleName ?? null, cleanMiddleInitial ?? null, cleanPhone, cleanPhone, cleanAddress, finalProfilePicture, cleanUsername]
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
  },

  async createRegistration({ first_name, middle_name = null, middle_initial = null, last_name, username, email, phone, address }) {
    const calculatedMi = middle_initial || (middle_name ? getMiddleInitial(middle_name) : null);
    const result = await query(
      'INSERT INTO pending_registrations (first_name, middle_name, middle_initial, last_name, username, email, phone, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [first_name, middle_name, calculatedMi, last_name, username, email, phone, address, 'pending']
    );
    return result.insertId;
  },

  async getPendingRegistrations() {
    return await query(`
      SELECT 
        p.id,
        p.first_name,
        p.middle_name,
        p.middle_initial,
        p.last_name,
        p.email,
        p.phone,
        p.address,
        p.username,
        p.created_at,
        p.status
      FROM pending_registrations p
      WHERE p.status = 'pending'
      ORDER BY p.created_at DESC
    `);
  },

  async getRegistrationById(id) {
    const rows = await query('SELECT * FROM pending_registrations WHERE id = ?', [id]);
    if (rows.length > 0) return rows[0];

    // Fallback to checking users table if not in pending_registrations
    const userRows = await query(
      `SELECT u.id, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.username, u.email, u.status, u.created_at, c.phone, c.address
       FROM users u
       LEFT JOIN customers c ON c.user_id = u.id
       WHERE u.id = ?`,
      [id]
    );
    return userRows[0] || null;
  },

  async updateRegistrationStatus(id, status) {
    return await query('UPDATE pending_registrations SET status = ? WHERE id = ?', [status, id]);
  }
};

module.exports = UserModel;
