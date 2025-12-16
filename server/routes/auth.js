const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Check if user exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (username, email, password, full_name, status) VALUES (?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name || username, 'offline']
    );

    // Create default settings
    await db.execute(
      'INSERT INTO user_settings (user_id) VALUES (?)',
      [result.insertId]
    );

    // Generate token
    const token = jwt.sign(
      { userId: result.insertId, username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.insertId,
        username,
        email,
        full_name: full_name || username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const [users] = await db.execute(
      'SELECT id, username, email, password, full_name, avatar_url, status FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update status to online
    await db.execute('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]);

    // Generate token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        status: 'online'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const [settings] = await db.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    res.json({
      user: req.user,
      settings: settings[0] || null
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update user status
router.put('/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['online', 'away', 'busy', 'offline'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await db.execute('UPDATE users SET status = ? WHERE id = ?', [status, req.user.id]);

    res.json({ message: 'Status updated', status });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Search users
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const searchTerm = `%${q}%`;
    const [users] = await db.execute(
      'SELECT id, username, email, full_name, avatar_url FROM users WHERE (username LIKE ? OR email LIKE ? OR full_name LIKE ?) AND id != ? LIMIT 20',
      [searchTerm, searchTerm, searchTerm, req.user.id]
    );

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Logout
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    await db.execute('UPDATE users SET status = ? WHERE id = ?', ['offline', req.user.id]);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;

