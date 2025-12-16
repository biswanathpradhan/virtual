const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get user settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [settings] = await db.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (settings.length === 0) {
      // Create default settings
      await db.execute(
        'INSERT INTO user_settings (user_id) VALUES (?)',
        [req.user.id]
      );
      const [newSettings] = await db.execute(
        'SELECT * FROM user_settings WHERE user_id = ?',
        [req.user.id]
      );
      return res.json(newSettings[0]);
    }

    res.json(settings[0]);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update user settings
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { audio_enabled, video_enabled, microphone_muted, camera_off, notifications_enabled, theme } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (audio_enabled !== undefined) {
      updateFields.push('audio_enabled = ?');
      updateValues.push(audio_enabled);
    }
    if (video_enabled !== undefined) {
      updateFields.push('video_enabled = ?');
      updateValues.push(video_enabled);
    }
    if (microphone_muted !== undefined) {
      updateFields.push('microphone_muted = ?');
      updateValues.push(microphone_muted);
    }
    if (camera_off !== undefined) {
      updateFields.push('camera_off = ?');
      updateValues.push(camera_off);
    }
    if (notifications_enabled !== undefined) {
      updateFields.push('notifications_enabled = ?');
      updateValues.push(notifications_enabled);
    }
    if (theme !== undefined) {
      updateFields.push('theme = ?');
      updateValues.push(theme);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(req.user.id);

    await db.execute(
      `UPDATE user_settings SET ${updateFields.join(', ')} WHERE user_id = ?`,
      updateValues
    );

    const [updated] = await db.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    res.json(updated[0]);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;

