const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types (you can add restrictions here)
    cb(null, true);
  }
});

// Upload file to room
router.post('/rooms/:roomId/files', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [result] = await db.execute(
      'INSERT INTO room_files (room_id, user_id, file_name, file_path, file_size, file_type, mime_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        roomId,
        req.user.id,
        req.file.originalname,
        req.file.path,
        req.file.size,
        path.extname(req.file.originalname),
        req.file.mimetype
      ]
    );

    // Get the uploaded file with user info
    const [files] = await db.execute(`
      SELECT f.*, u.username, u.full_name, u.avatar_url
      FROM room_files f
      JOIN users u ON f.user_id = u.id
      WHERE f.id = ?
    `, [result.insertId]);

    res.status(201).json(files[0]);
  } catch (error) {
    console.error('Upload file error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get room files
router.get('/rooms/:roomId/files', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const [files] = await db.execute(`
      SELECT f.*, u.username, u.full_name, u.avatar_url
      FROM room_files f
      JOIN users u ON f.user_id = u.id
      WHERE f.room_id = ?
      ORDER BY f.uploaded_at DESC
      LIMIT ? OFFSET ?
    `, [roomId, parseInt(limit), parseInt(offset)]);

    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Download file
router.get('/files/:id/download', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [files] = await db.execute(
      'SELECT * FROM room_files WHERE id = ?',
      [id]
    );

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    if (!fs.existsSync(file.file_path)) {
      return res.status(404).json({ error: 'File does not exist on server' });
    }

    res.download(file.file_path, file.file_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file (only own files or room creator)
router.delete('/files/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [files] = await db.execute(`
      SELECT f.*, r.created_by as room_creator
      FROM room_files f
      JOIN rooms r ON f.room_id = r.id
      WHERE f.id = ?
    `, [id]);

    if (files.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = files[0];

    // Check if user owns the file or is room creator
    if (file.user_id !== req.user.id && file.room_creator !== req.user.id) {
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }

    // Delete file from filesystem
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete from database
    await db.execute('DELETE FROM room_files WHERE id = ?', [id]);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;

