const express = require('express');
const router = express.Router();
const { login, register, getMe, setPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/admin/login', (req, res, next) => {
  req.body.portal = 'admin';
  login(req, res, next);
});
router.post('/cashier/login', (req, res, next) => {
  req.body.portal = 'cashier';
  login(req, res, next);
});
router.post('/customer/login', (req, res, next) => {
  req.body.portal = 'customer';
  login(req, res, next);
});

router.post('/register', register);
router.post('/set-password', setPassword);
router.get('/me', protect, getMe);

module.exports = router;
