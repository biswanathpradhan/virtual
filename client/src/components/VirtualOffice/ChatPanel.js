import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import './ChatPanel.css';

const ChatPanel = ({ roomId, isOpen, onClose }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (roomId && isOpen) {
      fetchMessages();
    }
  }, [roomId, isOpen]);

  useEffect(() => {
    if (socket) {
      socket.on('new-message', handleNewMessage);
      return () => {
        socket.off('new-message', handleNewMessage);
      };
    }
  }, [socket, roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/chat/rooms/${roomId}/messages?limit=100`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = (message) => {
    if (message.room_id === roomId || message.roomId === roomId) {
      setMessages((prev) => [...prev, message]);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    try {
      // Send via socket for real-time
      socket.emit('send-message', {
        roomId,
        message: newMessage,
        messageType: 'text'
      });

      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3>Room Chat</h3>
        <button onClick={onClose} className="chat-close-btn">×</button>
      </div>

      <div className="chat-messages" ref={chatContainerRef}>
        {loading ? (
          <div className="chat-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.user_id === user?.id ? 'own-message' : ''}`}
            >
              <div className="message-avatar">
                {message.avatar_url ? (
                  <img src={message.avatar_url} alt={message.username} />
                ) : (
                  <div className="avatar-placeholder">
                    {(message.username || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="message-content">
                <div className="message-header">
                  <span className="message-username">
                    {message.full_name || message.username || 'Unknown'}
                  </span>
                  <span className="message-time">{formatTime(message.created_at)}</span>
                </div>
                <div className="message-text">{message.message}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button type="submit" className="chat-send-btn" disabled={!newMessage.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;

