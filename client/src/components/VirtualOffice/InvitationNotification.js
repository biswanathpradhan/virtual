import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import './InvitationNotification.css';

const InvitationNotification = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (user) {
      fetchInvitations();
    }
  }, [user]);

  useEffect(() => {
    if (socket) {
      socket.on('new-invitation', handleNewInvitation);
      return () => {
        socket.off('new-invitation', handleNewInvitation);
      };
    }
  }, [socket]);

  const fetchInvitations = async () => {
    try {
      const response = await axios.get('/api/invitations/invitations?status=pending');
      setInvitations(response.data);
    } catch (error) {
      console.error('Fetch invitations error:', error);
    }
  };

  const handleNewInvitation = () => {
    fetchInvitations();
  };

  const handleAccept = async (invitationId, roomId) => {
    try {
      await axios.post(`/api/invitations/${invitationId}/accept`);
      setInvitations(invitations.filter((inv) => inv.id !== invitationId));
      navigate(`/office`);
      // Room will be auto-selected when navigating
    } catch (error) {
      console.error('Accept invitation error:', error);
      alert('Failed to accept invitation');
    }
  };

  const handleDecline = async (invitationId) => {
    try {
      await axios.post(`/api/invitations/${invitationId}/decline`);
      setInvitations(invitations.filter((inv) => inv.id !== invitationId));
    } catch (error) {
      console.error('Decline invitation error:', error);
      alert('Failed to decline invitation');
    }
  };

  if (invitations.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="invitation-bell"
        title={`${invitations.length} new invitation(s)`}
      >
        🔔
        {invitations.length > 0 && <span className="badge">{invitations.length}</span>}
      </button>

      {showPanel && (
        <div className="invitation-panel">
          <div className="invitation-header">
            <h3>Room Invitations ({invitations.length})</h3>
            <button onClick={() => setShowPanel(false)}>×</button>
          </div>
          <div className="invitation-list">
            {invitations.map((inv) => (
              <div key={inv.id} className="invitation-item">
                <div className="invitation-info">
                  <div className="invitation-title">
                    {inv.inviter_name || inv.inviter_username} invited you to
                  </div>
                  <div className="invitation-room">{inv.room_name}</div>
                  {inv.message && (
                    <div className="invitation-message">"{inv.message}"</div>
                  )}
                </div>
                <div className="invitation-actions">
                  <button
                    onClick={() => handleAccept(inv.id, inv.room_id)}
                    className="btn-accept"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(inv.id)}
                    className="btn-decline"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default InvitationNotification;

