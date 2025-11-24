const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
        success: false,
        message: 'No token provided'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }

    req.user = user;
    next();
  })
};


// doesn't block if no token, just adds user if present
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    req.user = err ? null : user;
    next();
  });
};


module.exports = {authenticateToken, optionalAuth};