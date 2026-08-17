const UserModel = require('../models/userModel');
const { generateTemporaryPassword } = require('../utils/passwordHelper');
const { sendAccountCredentialsEmail } = require('../utils/emailService');
const { saveAvatarImage } = require('../utils/avatarStorage');

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
        const { first_name, last_name, username, email, role, password, phone, address, profile_picture } = req.body;

        if (!first_name || !last_name || !email || !role) {
            return res.status(400).json({ message: 'Full Name (first and last name), Email Address, and Role are required.' });
        }

        const finalUsername = (username || `${first_name.trim().toLowerCase()}.${last_name.trim().toLowerCase()}`).replace(/\s+/g, '');

        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail) {
            return res.status(400).json({ message: 'Email address is already registered' });
        }

        const existingUsername = await UserModel.findByUsername(finalUsername);
        if (existingUsername) {
            return res.status(400).json({ message: `Username "${finalUsername}" is already taken` });
        }

        const tempPassword = password || generateTemporaryPassword(10);
        const isTemp = true;

        const id = await UserModel.createUser({
            first_name,
            last_name,
            username: finalUsername,
            email,
            password: tempPassword,
            role,
            is_active: true,
            is_temp_password: isTemp ? 1 : 0,
            profile_picture: profile_picture || null
        });

        if (role === 'customer' && (phone || address)) {
            const { query } = require('../config/db');
            await query(
                'INSERT INTO customers (user_id, phone, address, profile_image) VALUES (?, ?, ?, ?)',
                [id, phone || null, address || null, profile_picture || null]
            );
        }

        const fullName = `${first_name} ${last_name}`;

        const emailResult = await sendAccountCredentialsEmail({
            email,
            fullName,
            username: finalUsername,
            tempPassword,
            isReset: false
        });

        const createdUser = await UserModel.findById(id);

        res.status(201).json({
            message: `Account created successfully for ${fullName}. Credentials email sent to ${email}.`,
            user: createdUser,
            email_sent: emailResult.success,
            email_fallback: Boolean(emailResult.fallback)
        });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { first_name, last_name, username, email, role, profile_picture } = req.body;
        let savedAvatar = undefined;
        if (profile_picture) {
            savedAvatar = saveAvatarImage(profile_picture, req.params.id);
        }
        const user = await UserModel.updateUser(req.params.id, { first_name, last_name, username, email, role, profile_picture: savedAvatar });
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
        const user = await UserModel.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const tempPassword = req.body?.password || generateTemporaryPassword(10);
        await UserModel.resetPasswordWithTemp(user.id, tempPassword);

        const fullName = `${user.first_name} ${user.last_name}`;
        const username = user.username || user.email;

        const emailResult = await sendAccountCredentialsEmail({
            email: user.email,
            fullName,
            username,
            tempPassword,
            isReset: true
        });

        res.json({
            message: `Password reset successfully for ${fullName}. New credentials sent to ${user.email}.`,
            email_sent: emailResult.success,
            email_fallback: Boolean(emailResult.fallback)
        });
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
        const userId = req.user.id;
        const { first_name, last_name, username, email, phone, contact_number, address, profile_picture, profile_image } = req.body;

        if (!first_name || !first_name.trim() || !last_name || !last_name.trim()) {
            return res.status(400).json({ message: 'First name and last name are required' });
        }

        const inputImg = profile_picture || profile_image;
        let savedAvatarUrl = undefined;
        if (inputImg) {
            savedAvatarUrl = saveAvatarImage(inputImg, userId);
        }

        const updatedProfile = await UserModel.updateProfile(userId, {
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            username: username ? username.trim() : req.user.username,
            email: email ? email.trim() : req.user.email,
            phone: contact_number || phone || null,
            contact_number: contact_number || phone || null,
            address,
            profile_picture: savedAvatarUrl
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

        const { query } = require('../config/db');
        const users = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await UserModel.comparePassword(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        await UserModel.updatePassword(req.user.id, new_password);

        res.json({ message: 'Password changed successfully! You may now use your new password.' });
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
