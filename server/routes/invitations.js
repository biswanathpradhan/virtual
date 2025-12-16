const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Send invitation to room
router.post('/rooms/:roomId/invite', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { invitee_id, invitee_email, invitee_username, message } = req.body;

    // Validate input
    if (!invitee_id && !invitee_email && !invitee_username) {
      return res.status(400).json({ error: 'Must provide invitee_id, invitee_email, or invitee_username' });
    }

    // Check if room exists
    const [rooms] = await db.execute('SELECT id, name FROM rooms WHERE id = ?', [roomId]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    let inviteeId = null;

    // If invitee_id provided, use it
    if (invitee_id) {
      const [users] = await db.execute('SELECT id, email, username FROM users WHERE id = ?', [invitee_id]);
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      inviteeId = users[0].id;
    } else if (invitee_username) {
      // Find user by username
      const [users] = await db.execute('SELECT id, email, username FROM users WHERE username = ?', [invitee_username]);
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      inviteeId = users[0].id;
    } else if (invitee_email) {
      // Find user by email
      const [users] = await db.execute('SELECT id, email, username FROM users WHERE email = ?', [invitee_email]);
      if (users.length > 0) {
        inviteeId = users[0].id;
      }
    }

    // Check if user is already in room
    if (inviteeId) {
      const [existing] = await db.execute(
        'SELECT id FROM room_presence WHERE user_id = ? AND room_id = ?',
        [inviteeId, roomId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'User is already in this room' });
      }

      // Check for pending invitation
      const [pending] = await db.execute(
        'SELECT id FROM room_invitations WHERE room_id = ? AND invitee_id = ? AND status = ?',
        [roomId, inviteeId, 'pending']
      );
      if (pending.length > 0) {
        return res.status(400).json({ error: 'Invitation already sent to this user' });
      }
    }

    // Generate invitation token
    const invitationToken = uuidv4();

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [result] = await db.execute(
      'INSERT INTO room_invitations (room_id, inviter_id, invitee_id, invitee_email, invitee_username, invitation_token, message, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [roomId, req.user.id, inviteeId, invitee_email || null, invitee_username || null, invitationToken, message || null, expiresAt]
    );

    // Get invitation with details
    const [invitations] = await db.execute(`
      SELECT i.*, r.name as room_name, u.username as inviter_username, u.full_name as inviter_name
      FROM room_invitations i
      JOIN rooms r ON i.room_id = r.id
      JOIN users u ON i.inviter_id = u.id
      WHERE i.id = ?
    `, [result.insertId]);

    res.status(201).json(invitations[0]);
  } catch (error) {
    console.error('Send invitation error:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get user's invitations
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const [invitations] = await db.execute(`
      SELECT i.*, r.name as room_name, r.description as room_description,
             u.username as inviter_username, u.full_name as inviter_name, u.avatar_url as inviter_avatar
      FROM room_invitations i
      JOIN rooms r ON i.room_id = r.id
      JOIN users u ON i.inviter_id = u.id
      WHERE (i.invitee_id = ? OR i.invitee_email = ?)
      AND i.status = ?
      AND (i.expires_at IS NULL OR i.expires_at > NOW())
      ORDER BY i.created_at DESC
    `, [req.user.id, req.user.email, status]);

    res.json(invitations);
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Accept invitation
router.post('/invitations/:id/accept', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get invitation
    const [invitations] = await db.execute(`
      SELECT * FROM room_invitations WHERE id = ?
    `, [id]);

    if (invitations.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = invitations[0];

    // Verify user is the invitee
    if (invitation.invitee_id && invitation.invitee_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to accept this invitation' });
    }

    if (invitation.invitee_email && invitation.invitee_email !== req.user.email) {
      return res.status(403).json({ error: 'You are not authorized to accept this invitation' });
    }

    // Check if expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.execute('UPDATE room_invitations SET status = ? WHERE id = ?', ['expired', id]);
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if already responded
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already responded to' });
    }

    // Update invitation status
    await db.execute(
      'UPDATE room_invitations SET status = ?, responded_at = NOW() WHERE id = ?',
      ['accepted', id]
    );

    // Add user to room
    await db.execute(
      'INSERT INTO room_presence (user_id, room_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
      [req.user.id, invitation.room_id, 'active', 'active']
    );

    // Get room details
    const [rooms] = await db.execute('SELECT * FROM rooms WHERE id = ?', [invitation.room_id]);

    res.json({
      message: 'Invitation accepted',
      room: rooms[0]
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Decline invitation
router.post('/invitations/:id/decline', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get invitation
    const [invitations] = await db.execute('SELECT * FROM room_invitations WHERE id = ?', [id]);

    if (invitations.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = invitations[0];

    // Verify user is the invitee
    if (invitation.invitee_id && invitation.invitee_id !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to decline this invitation' });
    }

    if (invitation.invitee_email && invitation.invitee_email !== req.user.email) {
      return res.status(403).json({ error: 'You are not authorized to decline this invitation' });
    }

    // Update invitation status
    await db.execute(
      'UPDATE room_invitations SET status = ?, responded_at = NOW() WHERE id = ?',
      ['declined', id]
    );

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    console.error('Decline invitation error:', error);
    res.status(500).json({ error: 'Failed to decline invitation' });
  }
});

// Get sent invitations
router.get('/rooms/:roomId/invitations', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Check if user has permission (room creator or in room)
    const [rooms] = await db.execute('SELECT created_by FROM rooms WHERE id = ?', [roomId]);
    if (rooms.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [inRoom] = await db.execute(
      'SELECT id FROM room_presence WHERE user_id = ? AND room_id = ?',
      [req.user.id, roomId]
    );

    if (rooms[0].created_by !== req.user.id && inRoom.length === 0) {
      return res.status(403).json({ error: 'You do not have permission to view invitations for this room' });
    }

    const [invitations] = await db.execute(`
      SELECT i.*, u.username as invitee_username, u.full_name as invitee_name, u.avatar_url as invitee_avatar
      FROM room_invitations i
      LEFT JOIN users u ON i.invitee_id = u.id
      WHERE i.room_id = ?
      ORDER BY i.created_at DESC
    `, [roomId]);

    res.json(invitations);
  } catch (error) {
    console.error('Get room invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Accept invitation by token (for email links)
router.post('/invitations/token/:token/accept', authenticateToken, async (req, res) => {
  try {
    const { token } = req.params;

    const [invitations] = await db.execute(
      'SELECT * FROM room_invitations WHERE invitation_token = ?',
      [token]
    );

    if (invitations.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    const invitation = invitations[0];

    // Check if expired
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.execute('UPDATE room_invitations SET status = ? WHERE id = ?', ['expired', invitation.id]);
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Update invitee_id if not set
    if (!invitation.invitee_id) {
      await db.execute('UPDATE room_invitations SET invitee_id = ? WHERE id = ?', [req.user.id, invitation.id]);
    }

    // Check if already responded
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'Invitation already responded to' });
    }

    // Update invitation status
    await db.execute(
      'UPDATE room_invitations SET status = ?, responded_at = NOW() WHERE id = ?',
      ['accepted', invitation.id]
    );

    // Add user to room
    await db.execute(
      'INSERT INTO room_presence (user_id, room_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = ?',
      [req.user.id, invitation.room_id, 'active', 'active']
    );

    // Get room details
    const [rooms] = await db.execute('SELECT * FROM rooms WHERE id = ?', [invitation.room_id]);

    res.json({
      message: 'Invitation accepted',
      room: rooms[0]
    });
  } catch (error) {
    console.error('Accept invitation by token error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

module.exports = router;

