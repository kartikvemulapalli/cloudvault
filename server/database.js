const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists (supports persistent disks on Render via DATA_DIR)
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cloudvault.db');
const RETENTION_DAYS = 30;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cleanup_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      deleted_items INTEGER DEFAULT 0,
      removed_files INTEGER DEFAULT 0,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      original_name TEXT,
      filename TEXT,
      filepath TEXT,
      mime_type TEXT,
      size INTEGER DEFAULT 0,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.all('PRAGMA table_info(users)', (err, columns) => {
    if (!err && columns && !columns.some((c) => c.name === 'is_admin')) {
      db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
    }
  });

  db.all('PRAGMA table_info(items)', (err, columns) => {
    if (!err && columns) {
      const hasUserId = columns.some((c) => c.name === 'user_id');
      if (!hasUserId) {
        db.run('ALTER TABLE items ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
      }
    }
  });
});

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

const database = {
  RETENTION_DAYS,
  uploadsDir,

  async getUserCount() {
    const row = await get('SELECT COUNT(*) as count FROM users');
    return row ? row.count : 0;
  },

  async recordCleanupLog({ userId = null, action, deletedItems = 0, removedFiles = 0, details = '' } = {}) {
    const result = await run(
      `INSERT INTO cleanup_logs (user_id, action, deleted_items, removed_files, details, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [userId, action, deletedItems, removedFiles, details]
    );
    return await get('SELECT * FROM cleanup_logs WHERE id = ?', [result.id]);
  },

  async getCleanupLogs(limit = 10) {
    return await all(
      `SELECT cl.*, u.username
       FROM cleanup_logs cl
       LEFT JOIN users u ON u.id = cl.user_id
       ORDER BY cl.created_at DESC
       LIMIT ?`,
      [limit]
    );
  },

  async cleanupExpiredItems() {
    const expiredItems = await all(
      `SELECT * FROM items WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')`,
      [RETENTION_DAYS]
    );

    if (!expiredItems || expiredItems.length === 0) {
      return { deleted: 0, removedFiles: 0, log: null };
    }

    let removedFiles = 0;
    for (const item of expiredItems) {
      if (item.filename) {
        const filePath = path.join(uploadsDir, item.filename);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            removedFiles += 1;
          } catch (fileErr) {
            console.warn('Could not remove expired file from disk:', fileErr.message);
          }
        }
      }
    }

    const result = await run(
      `DELETE FROM items WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')`,
      [RETENTION_DAYS]
    );

    const log = await this.recordCleanupLog({
      action: 'auto_cleanup_30_days',
      deletedItems: result ? result.changes : 0,
      removedFiles,
      details: `Removed items older than ${RETENTION_DAYS} days and cleaned corresponding uploaded files.`
    });

    return {
      deleted: result ? result.changes : 0,
      removedFiles,
      log
    };
  },

  async createUser(username, passwordHash, isAdmin = false) {
    const result = await run(
      'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
      [username.trim(), passwordHash, isAdmin ? 1 : 0]
    );
    return await this.getUserById(result.id);
  },

  async getUserByUsername(username) {
    return await get('SELECT * FROM users WHERE username = ? COLLATE NOCASE', [username.trim()]);
  },

  async getUserById(id) {
    return await get('SELECT id, username, is_admin, created_at FROM users WHERE id = ?', [id]);
  },

  async getAllUsers() {
    return await all('SELECT id, username, is_admin, created_at FROM users ORDER BY created_at DESC');
  },

  async getAdminSummary() {
    const userTotal = await get('SELECT COUNT(*) as count FROM users');
    const adminTotal = await get('SELECT COUNT(*) as count FROM users WHERE is_admin = 1');
    const itemTotal = await get('SELECT COUNT(*) as count FROM items');
    const lastCleanup = await get('SELECT * FROM cleanup_logs ORDER BY created_at DESC LIMIT 1');

    return {
      totalUsers: userTotal ? userTotal.count : 0,
      totalAdmins: adminTotal ? adminTotal.count : 0,
      totalItems: itemTotal ? itemTotal.count : 0,
      retentionDays: RETENTION_DAYS,
      lastCleanup: lastCleanup || null
    };
  },

  async deleteUser(id) {
    const user = await this.getUserById(id);
    if (!user) return null;
    await run('DELETE FROM users WHERE id = ?', [id]);
    return user;
  },

  async deleteNonAdminUsers() {
    const rows = await all('SELECT id FROM users WHERE is_admin = 0');
    const ids = rows.map((row) => row.id);

    if (!ids.length) {
      return { deletedCount: 0 };
    }

    const placeholders = ids.map(() => '?').join(',');
    await run(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    await Promise.all(ids.map((id) => this.revokeAllRefreshTokensForUser(id)));
    return { deletedCount: ids.length };
  },

  async createRefreshToken({ userId, tokenHash, expiresAt }) {
    const result = await run(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at, created_at)
       VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP)`,
      [userId, tokenHash, expiresAt]
    );
    return await get('SELECT * FROM refresh_tokens WHERE id = ?', [result.id]);
  },

  async getRefreshTokenByHash(tokenHash) {
    return await get(
      `SELECT * FROM refresh_tokens
       WHERE token_hash = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')`,
      [tokenHash]
    );
  },

  async revokeRefreshTokenByHash(tokenHash) {
    await run(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
       WHERE token_hash = ? AND revoked_at IS NULL`,
      [tokenHash]
    );
  },

  async revokeAllRefreshTokensForUser(userId) {
    await run(
      `UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
  },

  async getItems({ userId, type, search } = {}) {
    let sql = 'SELECT * FROM items WHERE user_id = ?';
    const params = [userId];

    if (type && type !== 'all') {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (search && search.trim() !== '') {
      sql += ' AND (title LIKE ? OR content LIKE ? OR original_name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY created_at DESC';
    return await all(sql, params);
  },

  async getItemById(id, userId) {
    if (userId) {
      return await get('SELECT * FROM items WHERE id = ? AND user_id = ?', [id, userId]);
    }
    return await get('SELECT * FROM items WHERE id = ?', [id]);
  },

  async createTextItem({ userId, title, content }) {
    const size = Buffer.byteLength(content || '', 'utf8');
    const result = await run(
      `INSERT INTO items (user_id, title, type, content, size, mime_type, created_at, updated_at)
       VALUES (?, ?, 'text', ?, ?, 'text/plain', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, title, content, size]
    );
    return await this.getItemById(result.id, userId);
  },

  async updateTextItem({ id, userId, title, content }) {
    const size = Buffer.byteLength(content || '', 'utf8');
    await run(
      `UPDATE items
       SET title = ?, content = ?, size = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND type = 'text'`,
      [title, content, size, id, userId]
    );
    return await this.getItemById(id, userId);
  },

  async createFileItem({ userId, title, type, original_name, filename, filepath, mime_type, size }) {
    const result = await run(
      `INSERT INTO items (user_id, title, type, original_name, filename, filepath, mime_type, size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, title, type, original_name, filename, filepath, mime_type, size]
    );
    return await this.getItemById(result.id, userId);
  },

  async deleteItem(id, userId) {
    const item = await this.getItemById(id, userId);
    if (!item) return null;
    await run('DELETE FROM items WHERE id = ? AND user_id = ?', [id, userId]);
    return item;
  },

  async getStats(userId) {
    const total = await get(
      'SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as totalSize FROM items WHERE user_id = ?',
      [userId]
    );
    const textCount = await get(
      'SELECT COUNT(*) as count FROM items WHERE type = "text" AND user_id = ?',
      [userId]
    );
    const imageCount = await get(
      'SELECT COUNT(*) as count FROM items WHERE type = "image" AND user_id = ?',
      [userId]
    );
    const fileCount = await get(
      'SELECT COUNT(*) as count FROM items WHERE type = "file" AND user_id = ?',
      [userId]
    );

    return {
      totalItems: total ? total.count : 0,
      totalSize: total ? total.totalSize : 0,
      textCount: textCount ? textCount.count : 0,
      imageCount: imageCount ? imageCount.count : 0,
      fileCount: fileCount ? fileCount.count : 0,
    };
  }
};

module.exports = database;
