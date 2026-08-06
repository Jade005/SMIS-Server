const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

module.exports = router;
