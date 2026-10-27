const express = require('express');
const router = express.Router();
const {
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
  updateProfile
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

// Middleware: allow access if user is updating/viewing their own account OR if user is an admin
const authorizeSelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  if (String(req.user.id) === String(req.params.id) || req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    message: `Role '${req.user.role}' is not authorized to access this resource`
  });
};

// Profile routes for all authenticated users (Admin, Cashier, Customer)
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// Admin-only management routes
router.get('/', authorize('admin'), getUsers);
router.get('/pending', authorize('admin'), getPendingRegistrations);
router.patch('/registrations/:id/approve', authorize('admin'), approveRegistration);
router.patch('/registrations/:id/reject', authorize('admin'), rejectRegistration);
router.patch('/:id/status', authorize('admin'), toggleUserStatus);
router.patch('/:id/deactivate', authorize('admin'), deactivateUser);
router.patch('/:id/activate', authorize('admin'), activateUser);
router.delete('/:id', authorize('admin'), deleteUser);
// Password reset endpoints are permanently disabled (Admins cannot reset user passwords)
router.all('/:id/password', (req, res) => res.status(403).json({ message: 'Password reset is disabled. Administrators cannot reset user passwords.' }));
router.all('/:id/reset-password', (req, res) => res.status(403).json({ message: 'Password reset is disabled. Administrators cannot reset user passwords.' }));

// Self or Admin accessible routes
router.get('/:id', authorizeSelfOrAdmin, getUserById);
router.put('/:id', authorizeSelfOrAdmin, updateUser);

// Admin-only can register new accounts (Cashier access removed)
router.post('/', authorize('admin'), createUser);

module.exports = router;
