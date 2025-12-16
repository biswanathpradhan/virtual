const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get room messages
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [messages] = await db.execute(`
      SELECT m.*, u.username, u.full_name, u.avatar_url
      FROM room_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `, [roomId, parseInt(limit), parseInt(offset)]);

    res.json(messages.reverse()); // Reverse to show oldest first
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Send message
router.post('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, message_type = 'text' } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const [result] = await db.execute(
      'INSERT INTO room_messages (room_id, user_id, message, message_type) VALUES (?, ?, ?, ?)',
      [roomId, req.user.id, message.trim(), message_type]
    );

    // Get the created message with user info
    const [messages] = await db.execute(`
      SELECT m.*, u.username, u.full_name, u.avatar_url
      FROM room_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = ?
    `, [result.insertId]);

    res.status(201).json(messages[0]);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete message (only own messages)
router.delete('/messages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if message exists and belongs to user
    const [messages] = await db.execute(
      'SELECT user_id FROM room_messages WHERE id = ?',
      [id]
    );

    if (messages.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (messages[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await db.execute('DELETE FROM room_messages WHERE id = ?', [id]);

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;

