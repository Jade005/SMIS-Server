const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);
router.use(authorize('customer'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
