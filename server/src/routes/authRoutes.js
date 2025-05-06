const express = require('express');
const router = express.Router();
const passport = require('../passport');
const { register, login, logout, getUserStats, getTopContributors } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticateToken, logout);
router.get('/stats', authenticateToken, getUserStats);
router.get('/top-contributors', getTopContributors);

// Google OAuth routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    // On successful authentication, send token and user info to frontend
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
