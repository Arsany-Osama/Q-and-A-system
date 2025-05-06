const express = require('express');
const router = express.Router();
const passport = require('../services/passport');
const { register, login, logout, getUserStats, getTopContributors, verifyOTP, forgotPassword, resetPassword } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/stats', authenticateToken, getUserStats);
router.get('/top-contributors', getTopContributors);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const { token, user } = req.user;
    res.send(`
      <script>
        window.opener.postMessage({
          type: 'google-auth',
          success: true,
          token: '${token}',
          username: '${user.username}'
        }, '*');
        window.close();
      </script>
    `);
  }
);

module.exports = router;
