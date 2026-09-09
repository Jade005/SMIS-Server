const express = require('express');
const router = express.Router();
const { login, register, getMe, setPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.post('/set-password', setPassword);
router.get('/me', protect, getMe);

module.exports = router;
