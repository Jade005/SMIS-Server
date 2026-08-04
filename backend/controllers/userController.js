const UserModel = require('../models/userModel');

const getUsers = async (req, res, next) => {
    try {
        const { role, is_active } = req.query;
        const users = await UserModel.getAllUsers({ role, is_active });
        res.json(users);
    } catch (error) {
        next(error);
    }
};

const getUserById = async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        next(error);
    }
};

const createUser = async (req, res, next) => {
    try {
        const { first_name, last_name, email, password, role, phone, address } = req.body;

        if (!first_name || !last_name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const existing = await UserModel.findByEmail(email);
        if (existing) {
            return res.status(400).json({ message: 'Email is already registered' });
        }

        // Customers created by cashier also start as inactive (pending admin approval)
        const id = await UserModel.createUser({ first_name, last_name, email, password, role });

        // If registering a customer with contact info, create the customer profile
        if (role === 'customer' && (phone || address)) {
            const { query } = require('../config/db');
            await query(
                'INSERT INTO customers (user_id, phone, address) VALUES (?, ?, ?)',
                [id, phone || null, address || null]
            );
        }

        const user = await UserModel.findById(id);
        res.status(201).json({ message: 'Customer account created and pending admin approval.', user });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { first_name, last_name, email, role } = req.body;
        const user = await UserModel.updateUser(req.params.id, { first_name, last_name, email, role });
        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        next(error);
    }
};

const toggleUserStatus = async (req, res, next) => {
    try {
        const { is_active } = req.body;
        const user = await UserModel.toggleStatus(req.params.id, is_active);
        res.json({ message: `User status changed to ${is_active ? 'active' : 'inactive'}`, user });
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ message: 'New password is required' });
        }
        await UserModel.updatePassword(req.params.id, password);
        res.json({ message: 'User password reset successfully' });
    } catch (error) {
        next(error);
    }
};

const getPendingUsers = async (req, res, next) => {
    try {
        const users = await UserModel.getPendingUsers();
        res.json(users);
    } catch (error) {
        next(error);
    }
};

const approveUser = async (req, res, next) => {
    try {
        const user = await UserModel.approveUser(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found or not a pending customer' });
        }
        res.json({ message: `Account for ${user.first_name} ${user.last_name} approved successfully.`, user });
    } catch (error) {
        next(error);
    }
};

const getProfile = async (req, res, next) => {
  try {
    const profile = await UserModel.getProfile(req.user.id);
    if (!profile) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, phone, address } = req.body;
    if (!first_name || !last_name) {
      return res.status(400).json({ message: 'First name and last name are required' });
    }

    const updatedProfile = await UserModel.updateProfile(req.user.id, {
      first_name,
      last_name,
      phone,
      address
    });

    res.json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'Please provide all password fields' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters long' });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'New password and confirmation do not match' });
    }

    // Fetch user with password_hash
    const { query } = require('../config/db');
    const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await UserModel.comparePassword(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    await UserModel.updatePassword(req.user.id, new_password);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  getPendingUsers,
  approveUser,
  getProfile,
  updateProfile,
  changePassword
};
