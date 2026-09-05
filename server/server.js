const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');

const db = require('./database');
const { generateToken, hashToken, requireAuth, JWT_SECRET, REFRESH_TOKEN_EXPIRY } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Setup directories (supports persistent disks on Render via UPLOADS_DIR)
const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// Up to 50MB file uploads
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'public')));

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000
};

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000
};

function clearAuthCookies(res) {
  res.clearCookie('token', ACCESS_TOKEN_COOKIE_OPTIONS);
  res.clearCookie('refresh_token', REFRESH_TOKEN_COOKIE_OPTIONS);
}

async function issueSession(res, user) {
  const accessToken = generateToken(user, 'access');
  const refreshToken = generateToken(user, 'refresh');
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db.createRefreshToken({
    userId: user.id,
    tokenHash: refreshTokenHash,
    expiresAt
  });

  res.cookie('token', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie('refresh_token', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

  return {
    success: true,
    user: { id: user.id, username: user.username, is_admin: Boolean(user.is_admin) },
    accessToken,
    refreshToken
  };
}

function ensureAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required.' });
  }
  next();
}

// ==========================================================
// 1. AUTHENTICATION ROUTES
// ==========================================================

// Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Username must be at least 3 characters long.' });
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    const cleanUsername = username.trim();
    const existing = await db.getUserByUsername(cleanUsername);
    if (existing) {
      return res.status(409).json({ success: false, error: `Username "${cleanUsername}" is already taken. Please choose another.` });
    }

    const userCount = await db.getUserCount();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.createUser(cleanUsername, passwordHash, userCount === 0);

    const session = await issueSession(res, user);
    res.status(201).json(session);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed. Please try again.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const cleanUsername = username.trim();
    const user = await db.getUserByUsername(cleanUsername);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const session = await issueSession(res, user);
    res.json(session);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken || req.headers['x-refresh-token'];
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token required.' });
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    if (decoded.tokenType !== 'refresh') {
      return res.status(401).json({ success: false, error: 'Invalid refresh token.' });
    }

    const stored = await db.getRefreshTokenByHash(hashToken(refreshToken));
    if (!stored) {
      return res.status(401).json({ success: false, error: 'Session expired or revoked.' });
    }

    const user = await db.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists.' });
    }

    await db.revokeRefreshTokenByHash(hashToken(refreshToken));
    const session = await issueSession(res, user);
    res.json({ success: true, ...session });
  } catch (error) {
    console.error('Refresh token error:', error);
    clearAuthCookies(res);
    res.status(401).json({ success: false, error: 'Refresh token expired or invalid.' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const refreshToken = req.cookies.refresh_token;
    if (refreshToken) {
      await db.revokeRefreshTokenByHash(hashToken(refreshToken));
    }
    clearAuthCookies(res);
    res.json({ success: true, message: 'Signed out successfully.' });
  } catch (error) {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Signed out successfully.' });
  }
});

// Get current session user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    res.json({ success: true, user: { ...user, is_admin: Boolean(user.is_admin) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user profile.' });
  }
});

app.get('/api/admin/summary', requireAuth, ensureAdmin, async (req, res) => {
  try {
    const summary = await db.getAdminSummary();
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error fetching admin summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch admin summary.' });
  }
});

app.get('/api/admin/users', requireAuth, ensureAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users.' });
  }
});

app.get('/api/admin/logs', requireAuth, ensureAdmin, async (req, res) => {
  try {
    const logs = await db.getCleanupLogs(25);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching cleanup logs:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cleanup logs.' });
  }
});

app.delete('/api/admin/users/non-admins', requireAuth, ensureAdmin, async (req, res) => {
  try {
    const result = await db.deleteNonAdminUsers();
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error deleting non-admin users:', error);
    res.status(500).json({ success: false, error: 'Failed to delete non-admin users.' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, ensureAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (Number.isNaN(targetId) || targetId === req.userId) {
      return res.status(400).json({ success: false, error: 'You cannot delete your own admin account.' });
    }

    const deleted = await db.deleteUser(targetId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    await db.revokeAllRefreshTokensForUser(targetId);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user.' });
  }
});

// ==========================================================
// 2. PROTECTED VAULT ROUTES (STRICT USER ISOLATION)
// ==========================================================

// Get storage stats for current user
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const stats = await db.getStats(req.userId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Get list of items for current user (filtered by type or search)
app.get('/api/items', requireAuth, async (req, res) => {
  try {
    const { type, search } = req.query;
    const items = await db.getItems({ userId: req.userId, type, search });
    res.json({ success: true, items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch items' });
  }
});

// Create a text note / code snippet
app.post('/api/text', requireAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const item = await db.createTextItem({
      userId: req.userId,
      title: title.trim(),
      content: content || ''
    });
    res.status(201).json({ success: true, item });
  } catch (error) {
    console.error('Error saving text item:', error);
    res.status(500).json({ success: false, error: 'Failed to save text' });
  }
});

// Update a text note
app.put('/api/text/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }
    const item = await db.updateTextItem({
      id,
      userId: req.userId,
      title: title.trim(),
      content: content || ''
    });
    if (!item) {
      return res.status(404).json({ success: false, error: 'Text item not found or unauthorized' });
    }
    res.json({ success: true, item });
  } catch (error) {
    console.error('Error updating text item:', error);
    res.status(500).json({ success: false, error: 'Failed to update text' });
  }
});

// Upload files and images
app.post('/api/upload', requireAuth, (req, res, next) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, error: 'File size exceeds limit. Maximum allowed size is 50MB per file.' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, error: 'Too many files uploaded at once. Maximum limit is 20 files.' });
      }
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files selected for upload' });
    }

    const customTitle = req.body.title ? req.body.title.trim() : '';
    const createdItems = [];

    for (const file of req.files) {
      const mime = file.mimetype || 'application/octet-stream';
      const isImage = mime.startsWith('image/');
      const type = isImage ? 'image' : 'file';
      const itemTitle = customTitle && req.files.length === 1 ? customTitle : file.originalname;

      const item = await db.createFileItem({
        userId: req.userId,
        title: itemTitle,
        type: type,
        original_name: file.originalname,
        filename: file.filename,
        filepath: `/api/view/${file.filename}`, // Resolved to secure preview endpoint
        mime_type: mime,
        size: file.size
      });

      // Update filepath with item ID for secure scoped streaming
      item.filepath = `/api/view/${item.id}`;
      createdItems.push(item);
    }

    res.status(201).json({ success: true, items: createdItems });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ success: false, error: error.message || 'File upload failed' });
  }
});

// View / Preview an item (inline image or file) - STRICT OWNERSHIP VERIFIED
app.get('/api/view/:id', requireAuth, async (req, res) => {
  try {
    const item = await db.getItemById(req.params.id, req.userId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'File not found or unauthorized' });
    }

    if (item.type === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(item.content || '');
    }

    const filePath = path.join(uploadsDir, item.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', item.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error viewing item:', error);
    res.status(500).json({ success: false, error: 'Failed to view item' });
  }
});

// Download an item with original filename - STRICT OWNERSHIP VERIFIED
app.get('/api/download/:id', requireAuth, async (req, res) => {
  try {
    const item = await db.getItemById(req.params.id, req.userId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found or unauthorized' });
    }

    if (item.type === 'text') {
      const safeFilename = `${item.title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'note'}.txt`;
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.send(item.content || '');
    }

    const filePath = path.join(uploadsDir, item.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    }

    res.download(filePath, item.original_name || item.filename);
  } catch (error) {
    console.error('Error downloading item:', error);
    res.status(500).json({ success: false, error: 'Failed to download item' });
  }
});

// Delete an item - STRICT OWNERSHIP VERIFIED
app.delete('/api/items/:id', requireAuth, async (req, res) => {
  try {
    const item = await db.deleteItem(req.params.id, req.userId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found or unauthorized' });
    }

    // If it's an uploaded file or image, remove it from disk
    if (item.filename) {
      const filePath = path.join(uploadsDir, item.filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileErr) {
          console.warn('Could not remove file from disk:', fileErr.message);
        }
      }
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ success: false, error: 'Failed to delete item' });
  }
});

// Fallback to index.html for SPA (return JSON 404 for unmatched API routes)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start listening
const server = app.listen(PORT, HOST, async () => {
  console.log(`========================================`);
  console.log(` CloudVault Server is running!`);
  console.log(` Listening on: http://${HOST}:${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Storage Path: ${uploadsDir}`);
  console.log(` Data retention: ${db.RETENTION_DAYS} days`);
  console.log(`========================================`);

  try {
    const cleanup = await db.cleanupExpiredItems();
    if (cleanup.deleted > 0 || cleanup.removedFiles > 0) {
      console.log(` Cleanup removed ${cleanup.deleted} expired items and ${cleanup.removedFiles} files.`);
    }
  } catch (error) {
    console.error('Failed to run cleanup on startup:', error);
  }
});

setInterval(async () => {
  try {
    const cleanup = await db.cleanupExpiredItems();
    if (cleanup.deleted > 0 || cleanup.removedFiles > 0) {
      console.log(` Scheduled cleanup removed ${cleanup.deleted} expired items and ${cleanup.removedFiles} files.`);
    }
  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
  }
}, 60 * 60 * 1000);

module.exports = server;
