const jwt = require('jsonwebtoken');
const db = require('../config/database');

const initializeSocket = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Verify user exists
      const [users] = await db.execute('SELECT id, username, email, full_name, avatar_url, status, phone_number, designation, bio FROM users WHERE id = ?', [decoded.userId]);
      
      if (users.length === 0) {
        return next(new Error('User not found'));
      }

      socket.userId = decoded.userId;
      socket.user = users[0];
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.userId})`);

    // Join user-specific room for targeted messaging
    socket.join(`user:${socket.userId}`);

    // Update user status to online
    await db.execute('UPDATE users SET status = ? WHERE id = ?', ['online', socket.userId]);

    // Handle room join
    socket.on('join-room', async (data) => {
      try {
        const { roomId, position_x, position_y } = data;

        if (!roomId) {
          socket.emit('error', { message: 'Room ID is required' });
          return;
        }

        // Leave previous room if any
        if (socket.currentRoom) {
          socket.leave(socket.currentRoom);
        }

        socket.join(`room:${roomId}`);
        socket.currentRoom = roomId;

        // Update or create presence
        const [existing] = await db.execute(
          'SELECT id FROM room_presence WHERE user_id = ? AND room_id = ?',
          [socket.userId, roomId]
        );

        // If no position provided, calculate a default position
        let finalPositionX = position_x;
        let finalPositionY = position_y;

        if (!finalPositionX || !finalPositionY || (finalPositionX === 0 && finalPositionY === 0)) {
          // Get existing participants to avoid overlap
          const [existingParticipants] = await db.execute(
            'SELECT position_x, position_y FROM room_presence WHERE room_id = ?',
            [roomId]
          );

          // Calculate a grid position
          const cols = 5;
          const spacing = 150;
          const startX = 200;
          const startY = 200;
          const index = existingParticipants.length;
          finalPositionX = startX + (index % cols) * spacing;
          finalPositionY = startY + Math.floor(index / cols) * spacing;
        }

        if (existing.length > 0) {
          await db.execute(
            'UPDATE room_presence SET position_x = ?, position_y = ?, status = ?, last_seen = NOW() WHERE id = ?',
            [finalPositionX, finalPositionY, 'active', existing[0].id]
          );
        } else {
          await db.execute(
            'INSERT INTO room_presence (user_id, room_id, position_x, position_y, status) VALUES (?, ?, ?, ?, ?)',
            [socket.userId, roomId, finalPositionX, finalPositionY, 'active']
          );
        }

        // Get all users in room
        const [participants] = await db.execute(`
          SELECT rp.*, u.id as user_id, u.username, u.full_name, u.avatar_url, u.status, u.phone_number, u.designation, u.bio
          FROM room_presence rp
          JOIN users u ON rp.user_id = u.id
          WHERE rp.room_id = ?
        `, [roomId]);

        // Notify others in room
        socket.to(`room:${roomId}`).emit('user-joined', {
          user: socket.user,
          position: { x: position_x || 0, y: position_y || 0 }
        });

        // Send current participants to the new user
        socket.emit('room-participants', participants);

        console.log(`User ${socket.user.username} joined room ${roomId}`);
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Handle position update
    socket.on('update-position', async (data) => {
      try {
        const { roomId, position_x, position_y } = data;

        if (!socket.currentRoom || socket.currentRoom !== roomId) {
          return;
        }

        await db.execute(
          'UPDATE room_presence SET position_x = ?, position_y = ?, last_seen = NOW() WHERE user_id = ? AND room_id = ?',
          [position_x, position_y, socket.userId, roomId]
        );

        // Broadcast position to others in room
        socket.to(`room:${roomId}`).emit('user-position-updated', {
          userId: socket.userId,
          position: { x: position_x, y: position_y }
        });
      } catch (error) {
        console.error('Update position error:', error);
      }
    });

    // Handle status update
    socket.on('update-status', async (data) => {
      try {
        const { status } = data;
        const validStatuses = ['active', 'idle', 'away'];

        if (!validStatuses.includes(status)) {
          return;
        }

        await db.execute(
          'UPDATE room_presence SET status = ? WHERE user_id = ? AND room_id = ?',
          [status, socket.userId, socket.currentRoom]
        );

        if (socket.currentRoom) {
          socket.to(`room:${socket.currentRoom}`).emit('user-status-updated', {
            userId: socket.userId,
            status
          });
        }
      } catch (error) {
        console.error('Update status error:', error);
      }
    });

    // WebRTC signaling - Offer
    socket.on('webrtc-offer', (data) => {
      const { targetUserId, offer, roomId } = data;
      // Send to specific user if targetUserId provided, otherwise broadcast to room
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('webrtc-offer', {
          fromUserId: socket.userId,
          fromUser: socket.user,
          offer,
          roomId
        });
      } else {
        socket.to(`room:${roomId}`).emit('webrtc-offer', {
          fromUserId: socket.userId,
          fromUser: socket.user,
          offer,
          roomId
        });
      }
    });

    // WebRTC signaling - Answer
    socket.on('webrtc-answer', (data) => {
      const { targetUserId, answer, roomId } = data;
      // Send to specific user if targetUserId provided, otherwise broadcast to room
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('webrtc-answer', {
          fromUserId: socket.userId,
          fromUser: socket.user,
          answer,
          roomId
        });
      } else {
        socket.to(`room:${roomId}`).emit('webrtc-answer', {
          fromUserId: socket.userId,
          fromUser: socket.user,
          answer,
          roomId
        });
      }
    });

    // WebRTC signaling - ICE Candidate
    socket.on('webrtc-ice-candidate', (data) => {
      const { targetUserId, candidate, roomId } = data;
      // Send to specific user if targetUserId provided, otherwise broadcast to room
      if (targetUserId) {
        io.to(`user:${targetUserId}`).emit('webrtc-ice-candidate', {
          fromUserId: socket.userId,
          candidate,
          roomId
        });
      } else {
        socket.to(`room:${roomId}`).emit('webrtc-ice-candidate', {
          fromUserId: socket.userId,
          candidate,
          roomId
        });
      }
    });

    // Handle call initiation
    socket.on('call-initiate', async (data) => {
      try {
        const { roomId, callType, targetUserIds } = data;

        // Create call in database
        const [result] = await db.execute(
          'INSERT INTO calls (room_id, call_type, status, created_by) VALUES (?, ?, ?, ?)',
          [roomId, callType || 'both', 'ringing', socket.userId]
        );

        const callId = result.insertId;

        // Add creator as participant
        await db.execute(
          'INSERT INTO call_participants (call_id, user_id, audio_enabled, video_enabled) VALUES (?, ?, ?, ?)',
          [callId, socket.userId, true, true]
        );

        // Notify target users
        if (targetUserIds && Array.isArray(targetUserIds)) {
          for (const targetUserId of targetUserIds) {
            io.to(`user:${targetUserId}`).emit('incoming-call', {
              callId,
              fromUser: socket.user,
              callType: callType || 'both',
              roomId
            });
          }
        }

        socket.emit('call-initiated', { callId });
      } catch (error) {
        console.error('Call initiation error:', error);
        socket.emit('error', { message: 'Failed to initiate call' });
      }
    });

    // Handle call answer
    socket.on('call-answer', async (data) => {
      try {
        const { callId, accepted } = data;

        if (accepted) {
          await db.execute(
            'UPDATE calls SET status = ? WHERE id = ?',
            ['active', callId]
          );

          await db.execute(
            'INSERT INTO call_participants (call_id, user_id, audio_enabled, video_enabled) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE joined_at = NOW()',
            [callId, socket.userId, true, true]
          );

          // Get all participants and notify them
          const [participants] = await db.execute(
            'SELECT user_id FROM call_participants WHERE call_id = ?',
            [callId]
          );

          participants.forEach((p) => {
            io.to(`user:${p.user_id}`).emit('call-answered', {
              callId,
              user: socket.user
            });
          });
        } else {
          await db.execute(
            'UPDATE calls SET status = ? WHERE id = ?',
            ['missed', callId]
          );
        }
      } catch (error) {
        console.error('Call answer error:', error);
      }
    });

    // Handle call end
    socket.on('call-end', async (data) => {
      try {
        const { callId } = data;

        // Update participant left_at
        const [participant] = await db.execute(
          'SELECT id, joined_at FROM call_participants WHERE call_id = ? AND user_id = ?',
          [callId, socket.userId]
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

        // Check if there are any active participants left
        const [activeParticipants] = await db.execute(
          'SELECT COUNT(*) as count FROM call_participants WHERE call_id = ? AND left_at IS NULL',
          [callId]
        );

        // If no active participants, end the call
        if (activeParticipants[0].count === 0) {
          // Get call start time
          const [callData] = await db.execute(
            'SELECT started_at FROM calls WHERE id = ?',
            [callId]
          );

          if (callData.length > 0) {
            const startedAt = new Date(callData[0].started_at);
            const endedAt = new Date();
            const totalDuration = Math.floor((endedAt - startedAt) / 1000);

            await db.execute(
              'UPDATE calls SET status = ?, ended_at = NOW(), duration_seconds = ? WHERE id = ?',
              ['ended', totalDuration, callId]
            );
          }
        }

        // Broadcast call end to all participants
        const [allParticipants] = await db.execute(
          'SELECT user_id FROM call_participants WHERE call_id = ?',
          [callId]
        );

        allParticipants.forEach((p) => {
          io.to(`user:${p.user_id}`).emit('call-ended', {
            callId,
            user: socket.user
          });
        });
      } catch (error) {
        console.error('Call end error:', error);
        socket.emit('error', { message: 'Failed to end call' });
      }
    });

    // Handle room leave
    socket.on('leave-room', async () => {
      try {
        if (socket.currentRoom) {
          await db.execute(
            'DELETE FROM room_presence WHERE user_id = ? AND room_id = ?',
            [socket.userId, socket.currentRoom]
          );

          socket.to(`room:${socket.currentRoom}`).emit('user-left', {
            userId: socket.userId,
            user: socket.user
          });

          socket.leave(`room:${socket.currentRoom}`);
          socket.currentRoom = null;
        }
      } catch (error) {
        console.error('Leave room error:', error);
      }
    });

    // Handle chat messages
    socket.on('send-message', async (data) => {
      try {
        const { roomId, message, messageType = 'text' } = data;

        if (!roomId || !message || message.trim().length === 0) {
          socket.emit('error', { message: 'Room ID and message are required' });
          return;
        }

        // Save message to database
        const [result] = await db.execute(
          'INSERT INTO room_messages (room_id, user_id, message, message_type) VALUES (?, ?, ?, ?)',
          [roomId, socket.userId, message.trim(), messageType]
        );

        // Get message with user info
        const [messages] = await db.execute(`
          SELECT m.*, u.username, u.full_name, u.avatar_url
          FROM room_messages m
          JOIN users u ON m.user_id = u.id
          WHERE m.id = ?
        `, [result.insertId]);

        // Broadcast to all users in room
        io.to(`room:${roomId}`).emit('new-message', messages[0]);
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle screen sharing start
    socket.on('screen-share-start', async (data) => {
      try {
        const { callId, roomId } = data;

        // Create screen sharing session
        const [result] = await db.execute(
          'INSERT INTO screen_sharing_sessions (call_id, room_id, user_id, is_active) VALUES (?, ?, ?, ?)',
          [callId || null, roomId, socket.userId, true]
        );

        // Notify others in room/call
        if (roomId) {
          socket.to(`room:${roomId}`).emit('screen-share-started', {
            sessionId: result.insertId,
            userId: socket.userId,
            user: socket.user
          });
        }
      } catch (error) {
        console.error('Screen share start error:', error);
        socket.emit('error', { message: 'Failed to start screen sharing' });
      }
    });

    // Handle invitation sent
    socket.on('invitation-sent', async (data) => {
      try {
        const { invitee_id, room_id } = data;

        if (invitee_id) {
          // Notify the invitee
          io.to(`user:${invitee_id}`).emit('new-invitation', {
            room_id,
            inviter: socket.user
          });
        }
      } catch (error) {
        console.error('Invitation sent error:', error);
      }
    });

    // Handle screen sharing stop
    socket.on('screen-share-stop', async (data) => {
      try {
        const { sessionId } = data;

        if (sessionId) {
          await db.execute(
            'UPDATE screen_sharing_sessions SET is_active = FALSE, ended_at = NOW() WHERE id = ? AND user_id = ?',
            [sessionId, socket.userId]
          );
        }

        // Notify others
        if (socket.currentRoom) {
          socket.to(`room:${socket.currentRoom}`).emit('screen-share-stopped', {
            userId: socket.userId
          });
        }
      } catch (error) {
        console.error('Screen share stop error:', error);
      }
    });

    // Handle spatial audio ready
    socket.on('spatial-audio-ready', (data) => {
      const { roomId } = data;
      if (roomId && socket.currentRoom === roomId) {
        // Notify others in room that this user is ready for spatial audio
        socket.to(`room:${roomId}`).emit('spatial-audio-user-ready', {
          userId: socket.userId,
          user: socket.user
        });
      }
    });

    // Handle spatial audio WebRTC signaling
    socket.on('spatial-audio-offer', (data) => {
      const { toUserId, offer, roomId } = data;
      io.to(`user:${toUserId}`).emit('spatial-audio-offer', {
        fromUserId: socket.userId,
        offer,
        roomId
      });
    });

    socket.on('spatial-audio-answer', (data) => {
      const { toUserId, answer, roomId } = data;
      io.to(`user:${toUserId}`).emit('spatial-audio-answer', {
        fromUserId: socket.userId,
        answer,
        roomId
      });
    });

    socket.on('spatial-audio-ice-candidate', (data) => {
      const { toUserId, candidate, roomId } = data;
      io.to(`user:${toUserId}`).emit('spatial-audio-ice-candidate', {
        fromUserId: socket.userId,
        candidate,
        roomId
      });
    });

    // Handle mute/unmute
    socket.on('spatial-audio-mute', (data) => {
      const { roomId } = data;
      if (roomId && socket.currentRoom === roomId) {
        socket.to(`room:${roomId}`).emit('user-muted', {
          userId: socket.userId
        });
      }
    });

    socket.on('spatial-audio-unmute', (data) => {
      const { roomId } = data;
      if (roomId && socket.currentRoom === roomId) {
        socket.to(`room:${roomId}`).emit('user-unmuted', {
          userId: socket.userId
        });
      }
    });

    // Handle user activity tracking
    socket.on('user-activity', async (data) => {
      const { roomId } = data;
      try {
        // Update last activity time in database
        await db.execute(
          'UPDATE room_presence SET last_seen = NOW(), status = ? WHERE user_id = ? AND room_id = ?',
          ['active', socket.userId, roomId]
        );

        // Update user status to online if it was away/offline
        await db.execute(
          'UPDATE users SET status = ? WHERE id = ? AND status IN (?, ?)',
          ['online', socket.userId, 'away', 'offline']
        );

        // Notify others in room
        if (roomId && socket.currentRoom === roomId) {
          socket.to(`room:${roomId}`).emit('user-activity-update', {
            userId: socket.userId,
            status: 'active'
          });
        }
      } catch (error) {
        console.error('User activity update error:', error);
      }
    });

    // Handle user inactivity (15 minutes)
    socket.on('user-inactive', async (data) => {
      const { roomId } = data;
      try {
        // Update user status to away
        await db.execute(
          'UPDATE users SET status = ? WHERE id = ?',
          ['away', socket.userId]
        );

        // Update room presence status
        if (roomId) {
          await db.execute(
            'UPDATE room_presence SET status = ? WHERE user_id = ? AND room_id = ?',
            ['away', socket.userId, roomId]
          );

          // Notify others in room
          if (socket.currentRoom === roomId) {
            socket.to(`room:${roomId}`).emit('user-status-update', {
              userId: socket.userId,
              status: 'away'
            });
          }
        }
      } catch (error) {
        console.error('User inactive update error:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      try {
        console.log(`User disconnected: ${socket.user.username} (${socket.userId})`);

        // Stop any active screen sharing
        await db.execute(
          'UPDATE screen_sharing_sessions SET is_active = FALSE, ended_at = NOW() WHERE user_id = ? AND is_active = TRUE',
          [socket.userId]
        );

        // Remove from room presence
        if (socket.currentRoom) {
          await db.execute(
            'DELETE FROM room_presence WHERE user_id = ? AND room_id = ?',
            [socket.userId, socket.currentRoom]
          );

          socket.to(`room:${socket.currentRoom}`).emit('user-left', {
            userId: socket.userId,
            user: socket.user
          });
        }

        // Update user status to offline
        await db.execute('UPDATE users SET status = ? WHERE id = ?', ['offline', socket.userId]);
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });

  return io;
};

module.exports = { initializeSocket };

