const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'cloudvault-secret-key-2026-production-ready';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '30d';

function generateToken(user, type = 'access') {
  const expiry = type === 'refresh' ? REFRESH_TOKEN_EXPIRY : ACCESS_TOKEN_EXPIRY;

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      isAdmin: Boolean(user.is_admin),
      tokenType: type
    },
    JWT_SECRET,
    { expiresIn: expiry }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function requireAuth(req, res, next) {
  let token = null;

  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to access your vault.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.tokenType !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type. Please sign in again.'
      });
    }

    req.user = decoded;
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please sign in again.'
    });
  }
}

module.exports = {
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  generateToken,
  hashToken,
  requireAuth
};
