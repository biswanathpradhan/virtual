import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomParticipants, setRoomParticipants] = useState([]);

  useEffect(() => {
    if (user && token) {
      const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('room-participants', (participants) => {
        setRoomParticipants(participants);
      });

      newSocket.on('user-joined', (data) => {
        setRoomParticipants((prev) => {
          const exists = prev.find((p) => p.user_id === data.user.id);
          if (!exists) {
            return [...prev, { 
              ...data, 
              user_id: data.user.id, 
              ...data.user,
              position_x: data.position?.x || 0,
              position_y: data.position?.y || 0
            }];
          }
          return prev;
        });
      });

      newSocket.on('user-left', (data) => {
        setRoomParticipants((prev) => prev.filter((p) => p.user_id !== data.userId));
      });

      newSocket.on('user-position-updated', (data) => {
        setRoomParticipants((prev) =>
          prev.map((p) =>
            p.user_id === data.userId
              ? { ...p, position_x: data.position.x, position_y: data.position.y }
              : p
          )
        );
      });

      newSocket.on('user-status-updated', (data) => {
        setRoomParticipants((prev) =>
          prev.map((p) =>
            p.user_id === data.userId
              ? { ...p, status: data.status }
              : p
          )
        );
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [user, token]);

  const joinRoom = (roomId, position = { x: 0, y: 0 }) => {
    if (socket) {
      socket.emit('join-room', {
        roomId,
        position_x: position.x,
        position_y: position.y
      });
    }
  };

  const leaveRoom = () => {
    if (socket) {
      socket.emit('leave-room');
      setRoomParticipants([]);
    }
  };

  const updatePosition = (roomId, position) => {
    if (socket) {
      socket.emit('update-position', {
        roomId,
        position_x: position.x,
        position_y: position.y
      });
    }
  };

  const value = {
    socket,
    isConnected,
    roomParticipants,
    joinRoom,
    leaveRoom,
    updatePosition
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

