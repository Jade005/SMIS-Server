const UserModel = require('../models/userModel');
const { generateTemporaryPassword } = require('../utils/passwordHelper');
const { sendAccountCredentialsEmail } = require('../utils/emailService');
const { saveAvatarImage } = require('../utils/avatarStorage');
const { getMiddleInitial, sanitizeMiddleName, getDisplayName, generateUniqueSystemEmail } = require('../utils/nameHelper');

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
        // Enforce Admin role requirement (403 otherwise)
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden. Admin role required to register accounts.' });
        }

        const { first_name, middle_name, middle_initial, last_name, username, email, role, password, phone, address, profile_picture } = req.body;

        if (!first_name || !last_name || !email || !role) {
            return res.status(400).json({ message: 'Full Name (first and last name), Email Address, and Role are required.' });
        }

        const cleanMiddleName = middle_name ? sanitizeMiddleName(middle_name) : null;
        const cleanMiddleInitial = cleanMiddleName
            ? (middle_initial ? String(middle_initial).trim() : getMiddleInitial(cleanMiddleName))
            : null;

        const normalizedRole = role.toLowerCase() === 'user' ? 'customer' : role.toLowerCase();
        if (normalizedRole === 'admin') {
            return res.status(400).json({ message: 'Creating admin accounts is not permitted through this form. Only Cashier and Customer accounts can be created.' });
        }
        if (!['cashier', 'customer'].includes(normalizedRole)) {
            return res.status(400).json({ message: 'Invalid role specified. Only Cashier and Customer accounts can be created.' });
        }

        let cleanEmail = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
            return res.status(400).json({ message: 'Please provide a valid email address' });
        }

        const { query } = require('../config/db');

        // If duplicate email exists
        const existingEmail = await UserModel.findByEmail(cleanEmail);
        if (existingEmail) {
            if (cleanEmail.endsWith('@smis.local')) {
                cleanEmail = await generateUniqueSystemEmail(first_name, last_name, query);
            } else {
                return res.status(400).json({ message: 'Email address is already registered' });
            }
        }

        let finalUsername = (username || `${first_name.trim().toLowerCase()}.${last_name.trim().toLowerCase()}`).replace(/\s+/g, '');

        const existingUsername = await UserModel.findByUsername(finalUsername);
        if (existingUsername) {
            if (username) {
                return res.status(400).json({ message: `Username "${finalUsername}" is already taken` });
            } else {
                finalUsername = `${finalUsername}${Math.floor(100 + Math.random() * 900)}`;
            }
        }

        const tempPassword = password || generateTemporaryPassword(10);
        const isTemp = true;

        // Admin-created accounts are immediately 'active' (verified) and tracked by admin ID
        const adminId = req.user.id;
        const id = await UserModel.createUser({
            first_name: first_name.trim(),
            middle_name: cleanMiddleName,
            middle_initial: cleanMiddleInitial,
            last_name: last_name.trim(),
            username: finalUsername,
            email: cleanEmail,
            password: tempPassword,
            role: normalizedRole,
            status: 'active',
            is_active: true,
            is_temp_password: isTemp ? 1 : 0,
            temp_password_plain: tempPassword,
            profile_picture: profile_picture || null,
            registered_by: adminId,
            created_by_admin_id: adminId
        });

        if (normalizedRole === 'customer') {
            await query(
                'INSERT INTO customers (user_id, middle_name, middle_initial, phone, contact_number, address, profile_image, username, status, registered_by, created_by_admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, cleanMiddleName, cleanMiddleInitial, phone || null, phone || null, address || null, profile_picture || null, finalUsername, 'active', adminId, adminId]
            );
        }

        const fullName = getDisplayName({
            first_name: first_name.trim(),
            middle_name: cleanMiddleName,
            middle_initial: cleanMiddleInitial,
            last_name: last_name.trim()
        });

        // Audit log recording Admin registration action
        const adminActor = req.user ? `Admin ID ${req.user.id} (${req.user.username || req.user.email})` : 'Admin';
        console.log(`[AUDIT] [${new Date().toISOString()}] ${adminActor} registered new ${role} account: User ID ${id} (${fullName}, email: ${cleanEmail}, username: ${finalUsername}, status: ACTIVE/AUTO-APPROVED).`);

        const emailResult = await sendAccountCredentialsEmail({
            email: cleanEmail,
            fullName,
            username: finalUsername,
            tempPassword,
            isReset: false
        });

        const createdUser = await UserModel.findById(id);

        res.status(201).json({
            message: `Account created successfully for ${fullName}. Credentials email sent to ${email}.`,
            user: createdUser,
            temp_password: tempPassword,
            email_sent: emailResult.success,
            email_fallback: Boolean(emailResult.fallback)
        });
    } catch (error) {
        next(error);
    }
};

const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { first_name, middle_name, middle_initial, last_name, full_name, username, email, role, status, is_active, password, profile_picture } = req.body;

        const targetUser = await UserModel.findById(id);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        let fName = first_name;
        let lName = last_name;
        if ((fName === undefined || lName === undefined) && full_name) {
            const parts = full_name.trim().split(/\s+/);
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ') || '';
        }

        if (fName !== undefined && !fName.trim()) {
            return res.status(400).json({ message: 'First name cannot be empty' });
        }
        if (lName !== undefined && !lName.trim()) {
            return res.status(400).json({ message: 'Last name cannot be empty' });
        }

        let cleanMiddleName = undefined;
        let cleanMiddleInitial = undefined;
        if (middle_name !== undefined) {
            cleanMiddleName = middle_name ? sanitizeMiddleName(middle_name) : null;
            cleanMiddleInitial = cleanMiddleName
                ? (middle_initial !== undefined && middle_initial ? String(middle_initial).trim() : getMiddleInitial(cleanMiddleName))
                : null;
        } else if (middle_initial !== undefined) {
            cleanMiddleInitial = middle_initial ? String(middle_initial).trim() : null;
        }

        if (email !== undefined) {
            const cleanEmail = email.trim();
            if (!cleanEmail) {
                return res.status(400).json({ message: 'Email address cannot be empty' });
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
                return res.status(400).json({ message: 'Please provide a valid email address' });
            }
            const existingEmail = await UserModel.findByEmailExcludeId(cleanEmail, id);
            if (existingEmail) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        if (username !== undefined) {
            const cleanUsername = username.trim();
            if (!cleanUsername) {
                return res.status(400).json({ message: 'Username cannot be empty' });
            }
            const existingUsername = await UserModel.findByUsernameExcludeId(cleanUsername, id);
            if (existingUsername) {
                return res.status(400).json({ message: 'Username already exists' });
            }
        }

        // Normalize role
        let normalizedRole = role;
        if (normalizedRole) {
            if (normalizedRole.toLowerCase() === 'user') normalizedRole = 'customer';
            else normalizedRole = normalizedRole.toLowerCase();

            if (normalizedRole === 'admin' && targetUser.role !== 'admin') {
                return res.status(400).json({ message: 'Assigning Admin role is not permitted.' });
            }
        }

        // Normalize status / is_active
        let activeVal = is_active;
        if (status !== undefined) {
            const s = String(status).toLowerCase();
            if (s === 'active') activeVal = 1;
            else if (s === 'inactive' || s === 'pending') activeVal = 0;
        }

        let savedAvatar = undefined;
        if (profile_picture) {
            savedAvatar = saveAvatarImage(profile_picture, id);
        }

        const user = await UserModel.updateUser(id, {
            first_name: fName !== undefined ? fName.trim() : undefined,
            middle_name: cleanMiddleName,
            middle_initial: cleanMiddleInitial,
            last_name: lName !== undefined ? lName.trim() : undefined,
            username: username !== undefined ? username.trim() : undefined,
            email: email !== undefined ? email.trim() : undefined,
            role: normalizedRole,
            is_active: activeVal,
            password: password && password.trim() ? password.trim() : undefined,
            profile_picture: savedAvatar
        });

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        next(error);
    }
};

const toggleUserStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const user = await UserModel.findById(id);
        if (!user || user.deleted_at) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user && String(req.user.id) === String(id) && !is_active) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        if (user.role === 'admin' && user.is_active && !is_active) {
            const activeAdmins = await UserModel.countActiveAdmins();
            if (activeAdmins <= 1) {
                return res.status(400).json({ message: 'Cannot deactivate the last remaining active administrator.' });
            }
        }

        const updated = await UserModel.toggleStatus(id, is_active);
        res.json({ message: `User status changed to ${is_active ? 'active' : 'inactive'}`, user: updated });
    } catch (error) {
        next(error);
    }
};

const deactivateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findById(id);
        if (!user || user.deleted_at) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user && String(req.user.id) === String(id)) {
            return res.status(400).json({ message: 'You cannot deactivate your own account.' });
        }

        if (user.role === 'admin' && user.is_active) {
            const activeAdmins = await UserModel.countActiveAdmins();
            if (activeAdmins <= 1) {
                return res.status(400).json({ message: 'Cannot deactivate the last remaining active administrator.' });
            }
        }

        const updated = await UserModel.deactivateUser(id);
        res.json({ message: 'User deactivated successfully', user: updated });
    } catch (error) {
        next(error);
    }
};

const activateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findById(id);
        if (!user || user.deleted_at) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updated = await UserModel.activateUser(id);
        res.json({ message: 'User activated successfully', user: updated });
    } catch (error) {
        next(error);
    }
};

const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findById(id);
        if (!user || user.deleted_at) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.user && String(req.user.id) === String(id)) {
            return res.status(400).json({ message: 'You cannot delete your own account.' });
        }

        if (user.role === 'admin') {
            const activeAdmins = await UserModel.countActiveAdmins();
            if (activeAdmins <= 1) {
                return res.status(400).json({ message: 'Cannot delete the last remaining active administrator.' });
            }
        }

        const hasHistory = await UserModel.hasRelatedRecords(id);
        if (hasHistory) {
            return res.status(409).json({
                message: 'This user has related sales/order history and cannot be deleted. Deactivate the account instead.',
                canDeactivate: true
            });
        }

        await UserModel.deleteUser(id);
        res.json({ message: 'User deleted permanently' });
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

        const fullName = getDisplayName(user);
        const username = user.username || user.email;

        const emailResult = await sendAccountCredentialsEmail({
            email: user.email,
            fullName,
            username,
            tempPassword,
            isReset: true
        });

        res.json({
            message: `Password reset successfully for ${fullName}.`,
            temp_password: tempPassword,
            email_sent: emailResult.success,
            email_fallback: Boolean(emailResult.fallback)
        });
    } catch (error) {
        next(error);
    }
};

const getPendingRegistrations = async (req, res, next) => {
    try {
        const registrations = await UserModel.getPendingRegistrations();
        res.json(registrations);
    } catch (error) {
        next(error);
    }
};

const approveRegistration = async (req, res, next) => {
    let conn = null;
    try {
        const { pool } = require('../config/db');
        const bcrypt = require('bcryptjs');
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // 1. Lock and fetch registration from pending_registrations
        const [regRows] = await conn.execute(
            'SELECT * FROM pending_registrations WHERE id = ? FOR UPDATE',
            [req.params.id]
        );
        let reg = regRows[0];

        // Fallback: check users table if not found in pending_registrations
        if (!reg) {
            const [userRows] = await conn.execute(
                `SELECT u.id, u.first_name, u.middle_name, u.middle_initial, u.last_name, u.username, u.email, u.status, u.created_at, c.phone, c.address
                 FROM users u
                 LEFT JOIN customers c ON c.user_id = u.id
                 WHERE u.id = ? AND u.status = 'pending' FOR UPDATE`,
                [req.params.id]
            );
            reg = userRows[0];
        }

        if (!reg || reg.status !== 'pending') {
            await conn.rollback();
            return res.status(404).json({ message: 'Registration not found or not pending.' });
        }

        // 2. Generate temporary password at this moment
        const tempPassword = generateTemporaryPassword(10);
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(tempPassword, salt);

        // 3. Username and email preparation
        let finalUsername = reg.username;
        if (!finalUsername) {
            finalUsername = `${reg.first_name.trim().toLowerCase()}.${reg.last_name.trim().toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
        }
        const [existingUsernames] = await conn.execute(
            'SELECT id FROM users WHERE username = ? AND email != ?',
            [finalUsername, reg.email]
        );
        if (existingUsernames.length > 0) {
            finalUsername = `${finalUsername}${Math.floor(100 + Math.random() * 900)}`;
        }

        const regMi = reg.middle_initial || (reg.middle_name ? getMiddleInitial(reg.middle_name) : null);
        let userId = null;

        // 4. Check if user already exists in users table (e.g. from previous pending state)
        const [existingUsers] = await conn.execute(
            'SELECT id, email, status FROM users WHERE email = ? FOR UPDATE',
            [reg.email]
        );

        if (existingUsers.length > 0) {
            userId = existingUsers[0].id;
            // Update to active, set password hash, temp password flag = 1, temp_password_plain = NULL
            await conn.execute(
                `UPDATE users
                 SET status = 'active',
                     is_active = 1,
                     password_hash = ?,
                     is_temp_password = 1,
                     temp_password_plain = NULL,
                     username = ?,
                     middle_name = COALESCE(?, middle_name),
                     middle_initial = COALESCE(?, middle_initial),
                     updated_at = NOW()
                 WHERE id = ?`,
                [passwordHash, finalUsername, reg.middle_name || null, regMi, userId]
            );

            // Update customers table
            await conn.execute(
                `UPDATE customers
                 SET status = 'active',
                     username = ?,
                     phone = COALESCE(?, phone),
                     address = COALESCE(?, address),
                     updated_at = NOW()
                 WHERE user_id = ?`,
                [finalUsername, reg.phone || null, reg.address || null, userId]
            );
        } else {
            // Create brand new active user row inside transaction
            const [insertUser] = await conn.execute(
                `INSERT INTO users (first_name, middle_name, middle_initial, last_name, username, email, password_hash, role, status, is_active, is_temp_password, temp_password_plain, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'customer', 'active', 1, 1, NULL, NOW(), NOW())`,
                [
                    reg.first_name,
                    reg.middle_name || null,
                    regMi,
                    reg.last_name,
                    finalUsername,
                    reg.email,
                    passwordHash
                ]
            );
            userId = insertUser.insertId;

            await conn.execute(
                `INSERT INTO customers (user_id, middle_name, middle_initial, phone, contact_number, address, username, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
                [
                    userId,
                    reg.middle_name || null,
                    regMi,
                    reg.phone || null,
                    reg.phone || null,
                    reg.address || null,
                    finalUsername
                ]
            );
        }

        // 5. Update pending_registrations table to 'approved'
        await conn.execute(
            'UPDATE pending_registrations SET status = \'approved\' WHERE id = ? OR email = ?',
            [reg.id, reg.email]
        );

        // Commit all changes in this single transaction
        await conn.commit();

        const user = await UserModel.findById(userId);
        const fullName = getDisplayName(user || reg);

        // Audit log
        const adminActor = req.user ? `Admin ID ${req.user.id} (${req.user.username || req.user.email})` : 'Admin';
        console.log(`[AUDIT] [${new Date().toISOString()}] ${adminActor} approved (registered) account for ${fullName} (email: ${reg.email}, username: ${finalUsername}, status: active).`);

        // Send credentials email (graceful, don't throw)
        const emailResult = await sendAccountCredentialsEmail({
            email: reg.email,
            fullName,
            username: finalUsername,
            tempPassword,
            isReset: false
        });

        res.json({
            message: `Account for ${fullName} has been registered and approved! Status is now active.`,
            user,
            temp_password: tempPassword,
            email_sent: emailResult.success,
            email_fallback: Boolean(emailResult.fallback)
        });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (rbErr) {}
        }
        next(error);
    } finally {
        if (conn) conn.release();
    }
};

const rejectRegistration = async (req, res, next) => {
    let conn = null;
    try {
        const { pool } = require('../config/db');
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [regRows] = await conn.execute(
            'SELECT * FROM pending_registrations WHERE id = ? FOR UPDATE',
            [req.params.id]
        );
        let reg = regRows[0];

        if (!reg) {
            const [userRows] = await conn.execute(
                'SELECT u.id, u.first_name, u.last_name, u.email, u.status FROM users u WHERE u.id = ? AND u.status = \'pending\' FOR UPDATE',
                [req.params.id]
            );
            reg = userRows[0];
        }

        if (!reg || reg.status !== 'pending') {
            await conn.rollback();
            return res.status(404).json({ message: 'Registration not found or not pending.' });
        }

        const rejectionReason = req.body?.reason ? String(req.body.reason).trim() : null;

        // 1. Update pending_registrations table
        await conn.execute(
            'UPDATE pending_registrations SET status = \'rejected\', rejection_reason = ? WHERE id = ? OR email = ?',
            [rejectionReason, reg.id, reg.email]
        );

        // 2. Update users table status to 'rejected', deactivate, and clear password
        await conn.execute(
            'UPDATE users SET status = \'rejected\', is_active = 0, password_hash = NULL, temp_password_plain = NULL, updated_at = NOW() WHERE email = ? OR id = ?',
            [reg.email, reg.id]
        );

        // 3. Update customers table status to 'rejected'
        await conn.execute(
            'UPDATE customers SET status = \'rejected\', updated_at = NOW() WHERE user_id IN (SELECT id FROM users WHERE email = ?)',
            [reg.email]
        );

        await conn.commit();

        const adminActor = req.user ? `Admin ID ${req.user.id} (${req.user.username || req.user.email})` : 'Admin';
        console.log(`[AUDIT] [${new Date().toISOString()}] ${adminActor} rejected account request for ${reg.first_name} ${reg.last_name} (${reg.email}). Reason: ${rejectionReason || 'None provided'}`);

        res.json({ message: `Account request for ${reg.first_name} ${reg.last_name} was rejected.` });
    } catch (error) {
        if (conn) {
            try { await conn.rollback(); } catch (rbErr) {}
        }
        next(error);
    } finally {
        if (conn) conn.release();
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
    deactivateUser,
    activateUser,
    deleteUser,
    resetPassword,
    getPendingRegistrations,
    approveRegistration,
    rejectRegistration,
    getProfile,
    updateProfile,
    changePassword
};
