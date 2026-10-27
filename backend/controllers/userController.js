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

const getPendingRegistrations = async (req, res, next) => {
    try {
        const registrations = await UserModel.getPendingRegistrations();
        res.json(registrations);
    } catch (error) {
        next(error);
    }
};

const approveRegistration = async (req, res, next) => {
    try {
        const { query } = require('../config/db');
        const reg = await UserModel.getRegistrationById(req.params.id);
        if (!reg || reg.status !== 'pending') {
            return res.status(404).json({ message: 'Registration not found or not pending.' });
        }

        let userId = null;
        let tempPassword = generateTemporaryPassword(10);
        let finalUsername = reg.username;

        // Check if user already exists in users table
        const existingUser = await UserModel.findByEmail(reg.email);

        if (existingUser) {
            if (existingUser.status === 'active' && existingUser.is_active) {
                return res.status(400).json({ message: 'An active account with this email already exists.' });
            }
            userId = existingUser.id;
            finalUsername = existingUser.username || reg.username;

            // Activate user and set status to active
            await query(
                'UPDATE users SET status = ?, is_active = 1 WHERE id = ?',
                ['active', userId]
            );

            // Activate customer record
            await query(
                'UPDATE customers SET status = ? WHERE user_id = ?',
                ['active', userId]
            );

            // If user has a plain temp password already saved, reuse it; otherwise set new temp password
            if (existingUser.temp_password_plain) {
                tempPassword = existingUser.temp_password_plain;
            } else if (!existingUser.password_hash) {
                await UserModel.resetPasswordWithTemp(userId, tempPassword);
            }
        } else {
            // User not yet in users table, create active account
            if (!finalUsername) {
                finalUsername = `${reg.first_name.trim().toLowerCase()}.${reg.last_name.trim().toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
            }
            const existingUsername = await UserModel.findByUsername(finalUsername);
            if (existingUsername) {
                finalUsername = `${finalUsername}${Math.floor(100 + Math.random() * 900)}`;
            }

            const regMi = reg.middle_initial || (reg.middle_name ? getMiddleInitial(reg.middle_name) : null);
            userId = await UserModel.createUser({
                first_name: reg.first_name,
                middle_name: reg.middle_name || null,
                middle_initial: regMi,
                last_name: reg.last_name,
                username: finalUsername,
                email: reg.email,
                password: tempPassword,
                role: 'customer',
                status: 'active',
                is_active: 1,
                is_temp_password: 1,
                temp_password_plain: tempPassword
            });

            await query(
                'INSERT INTO customers (user_id, middle_name, middle_initial, phone, address, username, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, reg.middle_name || null, regMi, reg.phone || null, reg.address || null, finalUsername, 'active']
            );
        }

        // Mark pending registration as approved
        await query('UPDATE pending_registrations SET status = ? WHERE id = ? OR email = ?', ['approved', reg.id, reg.email]);

        const user = await UserModel.findById(userId);
        const fullName = getDisplayName(user || reg);

        // Audit log
        const adminActor = req.user ? `Admin ID ${req.user.id} (${req.user.username || req.user.email})` : 'Admin';
        console.log(`[AUDIT] [${new Date().toISOString()}] ${adminActor} approved (registered) account for ${fullName} (email: ${reg.email}, username: ${finalUsername}, status: active).`);

        // Send credentials email (graceful)
        const emailResult = await sendAccountCredentialsEmail({
            email: user.email,
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
        next(error);
    }
};

const rejectRegistration = async (req, res, next) => {
    try {
        const { query } = require('../config/db');
        const reg = await UserModel.getRegistrationById(req.params.id);
        if (!reg || reg.status !== 'pending') {
            return res.status(404).json({ message: 'Registration not found or not pending.' });
        }

        // Update pending_registrations table
        await query('UPDATE pending_registrations SET status = ? WHERE id = ? OR email = ?', ['rejected', reg.id, reg.email]);

        // Update users table status to 'rejected' and deactivate
        await query('UPDATE users SET status = ?, is_active = 0 WHERE id = ? OR email = ?', ['rejected', reg.id, reg.email]);

        // Update customers table status to 'rejected'
        await query('UPDATE customers SET status = ? WHERE user_id = ? OR user_id IN (SELECT id FROM users WHERE email = ?)', ['rejected', reg.id, reg.email]);

        const adminActor = req.user ? `Admin ID ${req.user.id} (${req.user.username || req.user.email})` : 'Admin';
        console.log(`[AUDIT] [${new Date().toISOString()}] ${adminActor} rejected account request for ${reg.first_name} ${reg.last_name} (${reg.email}).`);

        res.json({ message: `Account request for ${reg.first_name} ${reg.last_name} was rejected.` });
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
