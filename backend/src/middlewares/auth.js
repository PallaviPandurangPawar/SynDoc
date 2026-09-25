const jwt = require('jsonwebtoken');
const User = require('../models/User');

function getTokenFromRequest(req) {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

async function authenticateToken(token) {
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id);
}

/**
 * Verifies the JWT sent in the Authorization header (format: "Bearer <token>").
 * If valid, attaches the real logged-in user to req.user and continues.
 * If missing or invalid, rejects the request before it reaches the controller.
 */
const protect = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, no token provided'
      });
    }

    const user = await authenticateToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, invalid or expired token'
    });
  }
};

module.exports = { protect, getTokenFromRequest, authenticateToken };