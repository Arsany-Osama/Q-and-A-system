// routes/twofaRoutes.js
const { Router } = require('express');
const router = Router();

const { generate2FA, verify2FA, disable2FA, check2FAStatus } = require('../controllers/2faController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Routes that require JWT authentication
router.post('/setup', authenticateToken, generate2FA);
router.post('/verify', authenticateToken, verify2FA);
router.delete('/disable', authenticateToken, disable2FA);
router.get('/status', authenticateToken, check2FAStatus);

module.exports = router;
