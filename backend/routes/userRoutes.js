const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  toggleUserStatus,
  resetPassword,
  getPendingUsers,
  approveUser,
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
router.get('/pending', authorize('admin'), getPendingUsers);
router.patch('/:id/approve', authorize('admin'), approveUser);
router.patch('/:id/status', authorize('admin'), toggleUserStatus);
router.patch('/:id/password', authorize('admin'), resetPassword);

// Self or Admin accessible routes
router.get('/:id', authorizeSelfOrAdmin, getUserById);
router.put('/:id', authorizeSelfOrAdmin, updateUser);

// Admin + Cashier can register new accounts
router.post('/', authorize('admin', 'cashier'), createUser);

module.exports = router;
