const jwt = require('jsonwebtoken');
const { Router } = require('express');
const router = Router();

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('Authorization header:', authHeader);
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ success: false, message: 'Access denied: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Verified user:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ success: false, message: 'Invalid token: ' + err.message });
  }
};

router.post('/something', authenticateToken, (req, res) => {
  // Your controller logic here
  res.json({ success: true, message: 'Access granted to protected route' });
});

module.exports = { authenticateToken, router };
