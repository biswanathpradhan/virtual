const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create uploads directory for room backgrounds
const roomUploadsDir = path.join(__dirname, '../uploads/rooms');
if (!fs.existsSync(roomUploadsDir)) {
  fs.mkdirSync(roomUploadsDir, { recursive: true });
}

// Configure multer for room background uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, roomUploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const roomId = req.params.id || 'unknown';
      cb(null, `room-${roomId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Get all rooms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [rooms] = await db.execute(`
      SELECT r.*, 
             u.username as creator_username,
             COUNT(rp.user_id) as active_users
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN room_presence rp ON r.id = rp.room_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to get rooms' });
  }
});

// Get single room with participants
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [rooms] = await db.execute(`
      SELECT r.*, u.username as creator_username
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `, [id]);

    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = rooms[0];

    // Get active participants
    const [participants] = await db.execute(`
      SELECT rp.*, u.id as user_id, u.username, u.full_name, u.avatar_url, u.status, u.phone_number, u.designation, u.bio
      FROM room_presence rp
      JOIN users u ON rp.user_id = u.id
      WHERE rp.room_id = ?
    `, [id]);

    room.participants = participants;

    res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// Create room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, max_capacity, is_private } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO rooms (name, description, created_by, max_capacity, is_private) VALUES (?, ?, ?, ?, ?)',
      [name, description || null, req.user.id, max_capacity || 50, is_private || false]
    );

    const [newRoom] = await db.execute(`
      SELECT r.*, u.username as creator_username
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `, [result.insertId]);

    res.status(201).json(newRoom[0]);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join room
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { position_x, position_y } = req.body;

    // Check if room exists
    const [rooms] = await db.execute('SELECT id FROM rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if already in room
    const [existing] = await db.execute(
      'SELECT id FROM room_presence WHERE user_id = ? AND room_id = ?',
      [req.user.id, id]
    );

    if (existing.length > 0) {
      // Update position
      await db.execute(
        'UPDATE room_presence SET position_x = ?, position_y = ?, status = ?, last_seen = NOW() WHERE id = ?',
        [position_x || 0, position_y || 0, 'active', existing[0].id]
      );
    } else {
      // Add to room
      await db.execute(
        'INSERT INTO room_presence (user_id, room_id, position_x, position_y, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, id, position_x || 0, position_y || 0, 'active']
      );
    }

    res.json({ message: 'Joined room successfully' });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave room
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.execute(
      'DELETE FROM room_presence WHERE user_id = ? AND room_id = ?',
      [req.user.id, id]
    );

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Update position in room
router.put('/:id/position', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { position_x, position_y } = req.body;

    if (position_x === undefined || position_y === undefined) {
      return res.status(400).json({ error: 'Position coordinates are required' });
    }

    await db.execute(
      'UPDATE room_presence SET position_x = ?, position_y = ?, last_seen = NOW() WHERE user_id = ? AND room_id = ?',
      [position_x, position_y, req.user.id, id]
    );

    res.json({ message: 'Position updated' });
  } catch (error) {
    console.error('Update position error:', error);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// Update room background/layout
router.put('/:id/background', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { background_image_url, background_layout } = req.body;

    // Check if user is room creator
    const [rooms] = await db.execute('SELECT created_by FROM rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (rooms[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only room creator can update background' });
    }

    const updateFields = [];
    const updateValues = [];

    if (background_image_url !== undefined) {
      updateFields.push('background_image_url = ?');
      updateValues.push(background_image_url || null);
    }
    if (background_layout !== undefined) {
      const validLayouts = ['default', 'office', 'meeting', 'cozy', 'modern', 'custom'];
      if (!validLayouts.includes(background_layout)) {
        return res.status(400).json({ error: 'Invalid background layout' });
      }
      updateFields.push('background_layout = ?');
      updateValues.push(background_layout);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(id);

    await db.execute(
      `UPDATE rooms SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated room
    const [updatedRooms] = await db.execute(`
      SELECT r.*, u.username as creator_username
      FROM rooms r
      LEFT JOIN users u ON r.created_by = u.id
      WHERE r.id = ?
    `, [id]);

    res.json(updatedRooms[0]);
  } catch (error) {
    console.error('Update room background error:', error);
    res.status(500).json({ error: 'Failed to update room background' });
  }
});

// Upload room background image
router.post('/:id/background/upload', authenticateToken, upload.single('background'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Check if user is room creator
    const [rooms] = await db.execute('SELECT created_by, background_image_url FROM rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (rooms[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only room creator can upload background' });
    }

    const fileUrl = `/uploads/rooms/${req.file.filename}`;

    // Delete old background if exists
    if (rooms[0].background_image_url) {
      const oldPath = path.join(__dirname, '..', rooms[0].background_image_url);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update room background
    await db.execute(
      'UPDATE rooms SET background_image_url = ? WHERE id = ?',
      [fileUrl, id]
    );

    res.json({
      message: 'Background uploaded successfully',
      background_image_url: fileUrl
    });
  } catch (error) {
    console.error('Upload room background error:', error);
    res.status(500).json({ error: 'Failed to upload background' });
  }
});

// Delete room
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user is creator
    const [rooms] = await db.execute('SELECT created_by FROM rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (rooms[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Only room creator can delete the room' });
    }

    await db.execute('DELETE FROM rooms WHERE id = ?', [id]);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;

