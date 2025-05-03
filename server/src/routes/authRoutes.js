const express = require('express');
const router = express.Router();
const { register, login, logout, getUserStats } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/stats', authenticateToken, getUserStats); // New route

module.exports = router;
