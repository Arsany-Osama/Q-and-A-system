const jwt = require('jsonwebtoken');

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
    console.log('Verified user:', { id: decoded.id, role: decoded.role, state: decoded.state });
    if (!decoded.id || !decoded.role || !decoded.state) {
      return res.status(403).json({ success: false, message: 'Invalid token: Missing id, role, or state' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    return res.status(403).json({ success: false, message: 'Invalid token: ' + err.message });
  }
};

const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    console.log('checkRole - allowedRoles:', allowedRoles, 'req.user:', req.user);
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Access denied: No role found' });
    }

    if (Array.isArray(allowedRoles) && !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required role is one of [${allowedRoles.join(', ')}]`,
      });
    }

    if (!Array.isArray(allowedRoles) && req.user.role !== allowedRoles) {
      return res.status(403).json({
        success: false,
        message: `Access denied: Required role is ${allowedRoles}`,
      });
    }

    if (req.user.state !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Account is not approved',
      });
    }

    next();
  };
};


module.exports = { authenticateToken, checkRole };
