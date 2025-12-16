import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import axios from 'axios';
import RoomCanvas from './RoomCanvas';
import UserControls from './UserControls';
import CallInterface from './CallInterface';
import RoomList from './RoomList';
import ChatPanel from './ChatPanel';
import FilePanel from './FilePanel';
import InviteUsers from './InviteUsers';
import InvitationNotification from './InvitationNotification';
import ProfileSettings from './ProfileSettings';
import RoomSettings from './RoomSettings';
import SpatialAudio from './SpatialAudio';
import './VirtualOffice.css';

const VirtualOffice = () => {
  const { user, logout } = useAuth();
  const { socket, isConnected, roomParticipants, joinRoom, leaveRoom, updatePosition } = useSocket();
  const navigate = useNavigate();
  
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [myPosition, setMyPosition] = useState({ x: 0, y: 0 });
  const [isInCall, setIsInCall] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [showRoomList, setShowRoomList] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showRoomSettings, setShowRoomSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (currentRoom && socket) {
      // Calculate initial position to be visible (center of visible area)
      const initialPosition = { 
        x: window.innerWidth / 2 - 100, 
        y: window.innerHeight / 2 - 100 
      };
      setMyPosition(initialPosition);
      joinRoom(currentRoom.id, initialPosition);
    }

    return () => {
      if (currentRoom) {
        leaveRoom();
      }
    };
  }, [currentRoom, socket]);

  // Auto-position users when they join to make them all visible
  useEffect(() => {
    if (roomParticipants.length > 0 && currentRoom) {
      // Calculate a grid layout for all participants
      const cols = Math.ceil(Math.sqrt(roomParticipants.length + 1));
      const spacing = 150;
      const startX = 200;
      const startY = 200;

      // Position current user in center if not positioned
      if (myPosition.x === 0 && myPosition.y === 0) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        setMyPosition({ x: centerX, y: centerY });
        if (currentRoom) {
          updatePosition(currentRoom.id, { x: centerX, y: centerY });
        }
      }
    }
  }, [roomParticipants.length, currentRoom]);

  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = async (data) => {
      const { callId, fromUser, callType, roomId } = data;
      
      // Check if we're in the same room
      if (roomId === currentRoom?.id) {
        const accept = window.confirm(
          `Incoming ${callType === 'audio' ? 'audio' : callType === 'video' ? 'video' : 'audio & video'} call from ${fromUser.username}. Accept?`
        );

        if (accept) {
          try {
            // Join the call
            await axios.post(`/api/calls/${callId}/join`, {
              audio_enabled: true,
              video_enabled: callType !== 'audio'
            });

            // Get call details
            const response = await axios.get(`/api/calls/${callId}`);
            setCurrentCall(response.data);
            setIsInCall(true);

            // Notify via socket
            socket.emit('call-answer', {
              callId,
              accepted: true
            });
          } catch (error) {
            console.error('Failed to join call:', error);
            socket.emit('call-answer', {
              callId,
              accepted: false
            });
          }
        } else {
          // Reject call
          socket.emit('call-answer', {
            callId,
            accepted: false
          });
        }
      }
    };

    const handleCallEnded = () => {
      setIsInCall(false);
      setCurrentCall(null);
    };

    socket.on('incoming-call', handleIncomingCall);
    socket.on('call-ended', handleCallEnded);

    return () => {
      socket.off('incoming-call', handleIncomingCall);
      socket.off('call-ended', handleCallEnded);
    };
  }, [socket, currentRoom]);

  const fetchRooms = async () => {
    try {
      const response = await axios.get('/api/rooms');
      setRooms(response.data);
      
      // Auto-join first room if available
      if (response.data.length > 0 && !currentRoom) {
        setCurrentRoom(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const handleRoomSelect = (room) => {
    if (currentRoom) {
      leaveRoom();
    }
    setCurrentRoom(room);
    setShowRoomList(false);
  };

  const handlePositionChange = (newPosition) => {
    setMyPosition(newPosition);
    if (currentRoom) {
      updatePosition(currentRoom.id, newPosition);
    }
  };

  const handleStartCall = async (callType = 'both') => {
    try {
      const participantIds = roomParticipants
        .filter(p => p.user_id !== user.id)
        .map(p => p.user_id);

      // Create call in database
      const response = await axios.post('/api/calls', {
        room_id: currentRoom.id,
        call_type: callType,
        participant_ids: participantIds
      });

      setCurrentCall(response.data);
      setIsInCall(true);

      // Notify via socket
      if (socket) {
        socket.emit('call-initiate', {
          roomId: currentRoom.id,
          callType,
          targetUserIds: participantIds
        });
      }
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Failed to start call. Please try again.');
    }
  };

  const handleEndCall = async () => {
    if (currentCall) {
      try {
        // Leave call in database
        await axios.post(`/api/calls/${currentCall.id}/leave`);
        
        // Notify via socket
        if (socket) {
          socket.emit('call-end', { callId: currentCall.id });
        }
      } catch (error) {
        console.error('Failed to end call:', error);
      }
    }
    setIsInCall(false);
    setCurrentCall(null);
  };

  const handleLogout = async () => {
    if (currentRoom) {
      leaveRoom();
    }
    await logout();
    navigate('/login');
  };

  return (
    <div className="virtual-office">
      <header className="office-header">
        <div className="header-left">
          <h1>Virtual Office</h1>
          {currentRoom && (
            <>
              <span className="room-name">{currentRoom.name}</span>
              {roomParticipants.length > 0 && (
                <span className="room-active-indicator" title={`${roomParticipants.length} active user(s)`}>
                  <span className="active-dot"></span>
                  <span className="active-count">{roomParticipants.length}</span>
                </span>
              )}
              <button
                onClick={() => setShowRoomSettings(true)}
                className="btn-icon"
                title="Room Settings"
              >
                ⚙️
              </button>
            </>
          )}
        </div>
        <div className="header-right">
          <div className="user-info" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={user.username} className="user-avatar-small" />
            ) : (
              <div className="user-avatar-small placeholder">
                {(user?.username || 'U')[0].toUpperCase()}
              </div>
            )}
            <span className="username">{user?.username}</span>
            <span className={`status-indicator ${user?.status || 'offline'}`}></span>
          </div>
          <button onClick={() => navigate('/history')} className="btn-icon" title="Call History">
            📋
          </button>
          {currentRoom && (
            <>
              <button onClick={() => setShowInvite(true)} className="btn-icon" title="Invite Users">
                ➕
              </button>
              <button onClick={() => setShowFiles(!showFiles)} className="btn-icon" title="Files">
                📁
              </button>
              <button onClick={() => setShowChat(!showChat)} className="btn-icon" title="Chat">
                💬
              </button>
            </>
          )}
          <button onClick={handleLogout} className="btn-icon" title="Logout">
            🚪
          </button>
        </div>
      </header>

      <div className="office-content">
        {showRoomList ? (
          <RoomList
            rooms={rooms}
            onSelectRoom={handleRoomSelect}
            onCreateRoom={fetchRooms}
          />
        ) : (
          <>
            <div className="office-main">
              <RoomCanvas
                participants={roomParticipants}
                myPosition={myPosition}
                onPositionChange={handlePositionChange}
                currentUser={user}
                room={currentRoom}
              />
              
              {isInCall && currentCall && (
                <CallInterface
                  call={currentCall}
                  onEndCall={handleEndCall}
                  socket={socket}
                  currentUser={user}
                />
              )}
            </div>

            <UserControls
              onStartCall={handleStartCall}
              onEndCall={handleEndCall}
              isInCall={isInCall}
              onBackToRooms={() => {
                leaveRoom();
                setCurrentRoom(null);
                setShowRoomList(true);
              }}
              participants={roomParticipants}
            />

            {/* Spatial Audio Component - Always active when in room */}
            {currentRoom && !isInCall && (
              <SpatialAudio
                participants={roomParticipants}
                myPosition={myPosition}
                currentUser={user}
                roomId={currentRoom.id}
                socket={socket}
                isMuted={isMuted}
                onMuteChange={setIsMuted}
              />
            )}
          </>
        )}
      </div>

      <InvitationNotification />

      <ProfileSettings
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />

      {currentRoom && (
        <>
          <RoomSettings
            room={currentRoom}
            isOpen={showRoomSettings}
            onClose={() => setShowRoomSettings(false)}
            onUpdate={(updatedRoom) => setCurrentRoom(updatedRoom)}
          />
          <InviteUsers
            roomId={currentRoom.id}
            isOpen={showInvite}
            onClose={() => setShowInvite(false)}
          />
          <ChatPanel
            roomId={currentRoom.id}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />
          <FilePanel
            roomId={currentRoom.id}
            isOpen={showFiles}
            onClose={() => setShowFiles(false)}
          />
        </>
      )}

      {!isConnected && (
        <div className="connection-status error">
          <span className="status-icon">⚠️</span>
          <span>Disconnected - Attempting to reconnect...</span>
        </div>
      )}
      
      {isConnected && (
        <div className="connection-status connected">
          <span className="status-icon">✓</span>
          <span>Connected</span>
        </div>
      )}
    </div>
  );
};

export default VirtualOffice;

