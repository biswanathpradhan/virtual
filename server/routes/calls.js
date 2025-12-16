const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create/Start a call
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { room_id, call_type, participant_ids } = req.body;

    if (!room_id) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // Create call record
    const [result] = await db.execute(
      'INSERT INTO calls (room_id, call_type, status, created_by) VALUES (?, ?, ?, ?)',
      [room_id, call_type || 'both', 'initiated', req.user.id]
    );

    const callId = result.insertId;

    // Add creator as participant
    await db.execute(
      'INSERT INTO call_participants (call_id, user_id, audio_enabled, video_enabled) VALUES (?, ?, ?, ?)',
      [callId, req.user.id, true, true]
    );

    // Add other participants if provided
    if (participant_ids && Array.isArray(participant_ids)) {
      for (const participantId of participant_ids) {
        if (participantId !== req.user.id) {
          await db.execute(
            'INSERT INTO call_participants (call_id, user_id, audio_enabled, video_enabled) VALUES (?, ?, ?, ?)',
            [callId, participantId, true, true]
          );
        }
      }
    }

    // Get full call details
    const [calls] = await db.execute(`
      SELECT c.*, u.username as creator_username
      FROM calls c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [callId]);

    const call = calls[0];

    // Get participants
    const [participants] = await db.execute(`
      SELECT cp.*, u.username, u.full_name, u.avatar_url
      FROM call_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.call_id = ?
    `, [callId]);

    call.participants = participants;

    res.status(201).json(call);
  } catch (error) {
    console.error('Create call error:', error);
    res.status(500).json({ error: 'Failed to create call' });
  }
});

// Get call details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [calls] = await db.execute(`
      SELECT c.*, u.username as creator_username
      FROM calls c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [id]);

    if (calls.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = calls[0];

    // Get participants
    const [participants] = await db.execute(`
      SELECT cp.*, u.username, u.full_name, u.avatar_url
      FROM call_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.call_id = ?
    `, [id]);

    call.participants = participants;

    res.json(call);
  } catch (error) {
    console.error('Get call error:', error);
    res.status(500).json({ error: 'Failed to get call' });
  }
});

// Join a call
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { audio_enabled, video_enabled } = req.body;

    // Check if call exists
    const [calls] = await db.execute('SELECT id, status FROM calls WHERE id = ?', [id]);
    if (calls.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    // Check if already a participant
    const [existing] = await db.execute(
      'SELECT id FROM call_participants WHERE call_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (existing.length > 0) {
      // Update join time
      await db.execute(
        'UPDATE call_participants SET joined_at = NOW(), audio_enabled = ?, video_enabled = ? WHERE id = ?',
        [audio_enabled !== false, video_enabled !== false, existing[0].id]
      );
    } else {
      // Add as participant
      await db.execute(
        'INSERT INTO call_participants (call_id, user_id, audio_enabled, video_enabled) VALUES (?, ?, ?, ?)',
        [id, req.user.id, audio_enabled !== false, video_enabled !== false]
      );
    }

    // Update call status to active if it was initiated
    await db.execute(
      'UPDATE calls SET status = ? WHERE id = ? AND status = ?',
      ['active', id, 'initiated']
    );

    res.json({ message: 'Joined call successfully' });
  } catch (error) {
    console.error('Join call error:', error);
    res.status(500).json({ error: 'Failed to join call' });
  }
});

// Leave/End a call
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Update participant left_at
    const [participant] = await db.execute(
      'SELECT id, joined_at FROM call_participants WHERE call_id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (participant.length > 0) {
      const joinedAt = new Date(participant[0].joined_at);
      const leftAt = new Date();
      const durationSeconds = Math.floor((leftAt - joinedAt) / 1000);

      await db.execute(
        'UPDATE call_participants SET left_at = NOW(), duration_seconds = ? WHERE id = ?',
        [durationSeconds, participant[0].id]
      );
    }

    // Check if call should be ended (no active participants)
    const [activeParticipants] = await db.execute(
      'SELECT COUNT(*) as count FROM call_participants WHERE call_id = ? AND left_at IS NULL',
      [id]
    );

    if (activeParticipants[0].count === 0) {
      // Calculate total call duration
      const [call] = await db.execute('SELECT started_at FROM calls WHERE id = ?', [id]);
      if (call.length > 0) {
        const startedAt = new Date(call[0].started_at);
        const endedAt = new Date();
        const durationSeconds = Math.floor((endedAt - startedAt) / 1000);

        await db.execute(
          'UPDATE calls SET status = ?, ended_at = NOW(), duration_seconds = ? WHERE id = ?',
          ['ended', durationSeconds, id]
        );
      }
    }

    res.json({ message: 'Left call successfully' });
  } catch (error) {
    console.error('Leave call error:', error);
    res.status(500).json({ error: 'Failed to leave call' });
  }
});

// Update participant settings (mute/unmute, camera on/off)
router.put('/:id/participant', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { audio_enabled, video_enabled } = req.body;

    await db.execute(
      'UPDATE call_participants SET audio_enabled = ?, video_enabled = ? WHERE call_id = ? AND user_id = ?',
      [audio_enabled, video_enabled, id, req.user.id]
    );

    res.json({ message: 'Participant settings updated' });
  } catch (error) {
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Failed to update participant settings' });
  }
});

// Get call history
router.get('/history/all', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const [calls] = await db.execute(`
      SELECT c.*, u.username as creator_username,
             COUNT(DISTINCT cp.user_id) as participant_count
      FROM calls c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN call_participants cp ON c.id = cp.call_id
      WHERE c.status = 'ended' OR c.status = 'active'
      GROUP BY c.id
      ORDER BY c.started_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);

    res.json(calls);
  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

// Get user's call history
router.get('/history/me', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const [calls] = await db.execute(`
      SELECT DISTINCT c.*, u.username as creator_username,
             COUNT(DISTINCT cp.user_id) as participant_count
      FROM calls c
      LEFT JOIN users u ON c.created_by = u.id
      LEFT JOIN call_participants cp ON c.id = cp.call_id
      WHERE cp.user_id = ?
      GROUP BY c.id
      ORDER BY c.started_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.id, parseInt(limit), parseInt(offset)]);

    res.json(calls);
  } catch (error) {
    console.error('Get user call history error:', error);
    res.status(500).json({ error: 'Failed to get call history' });
  }
});

// Start recording a call
router.post('/:id/record', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if call exists and is active
    const [calls] = await db.execute('SELECT id, status FROM calls WHERE id = ?', [id]);
    if (calls.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    if (calls[0].status !== 'active') {
      return res.status(400).json({ error: 'Can only record active calls' });
    }

    // Create recording record
    const [result] = await db.execute(
      'INSERT INTO call_recordings (call_id, recording_status) VALUES (?, ?)',
      [id, 'pending']
    );

    res.status(201).json({
      id: result.insertId,
      call_id: id,
      recording_status: 'pending',
      message: 'Recording started'
    });
  } catch (error) {
    console.error('Start recording error:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// Stop recording
router.post('/:id/record/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { file_path, file_size, duration_seconds } = req.body;

    const [recordings] = await db.execute(
      'SELECT id FROM call_recordings WHERE call_id = ? AND recording_status = ?',
      [id, 'pending']
    );

    if (recordings.length === 0) {
      return res.status(404).json({ error: 'No active recording found' });
    }

    await db.execute(
      'UPDATE call_recordings SET file_path = ?, file_size = ?, duration_seconds = ?, recording_status = ? WHERE id = ?',
      [file_path || null, file_size || null, duration_seconds || null, 'completed', recordings[0].id]
    );

    res.json({ message: 'Recording stopped' });
  } catch (error) {
    console.error('Stop recording error:', error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// Get detailed call review
router.get('/:id/review', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get call details
    const [calls] = await db.execute(`
      SELECT c.*, u.username as creator_username, u.full_name as creator_name
      FROM calls c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `, [id]);

    if (calls.length === 0) {
      return res.status(404).json({ error: 'Call not found' });
    }

    const call = calls[0];

    // Get all participants with details
    const [participants] = await db.execute(`
      SELECT cp.*, u.username, u.full_name, u.avatar_url, u.email
      FROM call_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.call_id = ?
      ORDER BY cp.joined_at ASC
    `, [id]);

    call.participants = participants;

    // Get recordings if any
    const [recordings] = await db.execute(
      'SELECT * FROM call_recordings WHERE call_id = ?',
      [id]
    );

    call.recordings = recordings;

    res.json(call);
  } catch (error) {
    console.error('Get call review error:', error);
    res.status(500).json({ error: 'Failed to get call review' });
  }
});

module.exports = router;

