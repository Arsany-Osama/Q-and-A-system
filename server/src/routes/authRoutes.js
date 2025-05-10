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
  (req, res) => {    const { token, user } = req.user;
    const safeUsername = encodeURIComponent(user.username);
    const safeRole = encodeURIComponent(user.role);
    const safeState = encodeURIComponent(user.state);

    res.send(`
      <script>
        window.opener.postMessage({
          type: 'google-auth',
          success: true,
          token: '${token}',
          username: '${safeUsername}',
          role: '${safeRole}',
          state: '${safeState}'
        }, '*');
        window.close();
      </script>
    `);
  }
);

// Auth0 routes
router.get(
  '/auth0',
  passport.authenticate('auth0', {
    scope: 'openid email profile',
    prompt: 'login',
    session: false
  })
);

router.get(
  '/auth0/callback',
  passport.authenticate('auth0', { 
    session: false,
    failureRedirect: '/'
  }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/?error=auth_failed');
    }
    
    try {
      const { token, user } = req.user;
      const safeUsername = encodeURIComponent(user.username);
      const safeRole = encodeURIComponent(user.role);
      const safeState = encodeURIComponent(user.state);
      
      res.send(`
        <script>
          try {
            window.opener.postMessage({
              type: 'auth0-auth',
              success: true,
              token: '${token}',
              username: '${safeUsername}',
              role: '${safeRole}',
              state: '${safeState}'
            }, '*');
          } catch (e) {
            console.error('Post message error:', e);
          } finally {
            window.close();
          }
        </script>
      `);
    } catch (error) {
      console.error('Auth0 callback error:', error);
      res.redirect('/?error=auth_error');
    }
  }
);

module.exports = router;
