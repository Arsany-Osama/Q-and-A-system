const express = require('express');
const router = express.Router();
const { register, login, logout, getUserStats, getTopContributors } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/stats', authenticateToken, getUserStats); // New route
router.get('/top-contributors', getTopContributors); // Route for top contributors

module.exports = router;
