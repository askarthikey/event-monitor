const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      message: 'error',
      payload: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        message: 'error',
        payload: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.usertype !== 'admin') {
    return res.status(403).json({
      message: 'error',
      payload: 'Admin access required'
    });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin };
