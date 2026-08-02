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
  approveUser
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

// Admin-only routes
router.get('/', authorize('admin'), getUsers);
router.get('/pending', authorize('admin'), getPendingUsers);
router.patch('/:id/approve', authorize('admin'), approveUser);
router.get('/:id', authorize('admin'), getUserById);
router.put('/:id', authorize('admin'), updateUser);
router.patch('/:id/status', authorize('admin'), toggleUserStatus);
router.patch('/:id/password', authorize('admin'), resetPassword);

// Admin + Cashier can register new customers
router.post('/', authorize('admin', 'cashier'), createUser);

module.exports = router;

