const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }

    if (req.user.state !== 'APPROVED') {
      return res.status(403).json({ success: false, message: 'Your account is not approved' });
    }

    next();
  };
};

module.exports = { authorizeRoles };
