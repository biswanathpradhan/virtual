import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import './InviteUsers.css';

const InviteUsers = ({ roomId, isOpen, onClose }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [invitationMessage, setInvitationMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentInvitations, setSentInvitations] = useState([]);

  useEffect(() => {
    if (isOpen && roomId) {
      fetchSentInvitations();
    }
  }, [isOpen, roomId]);

  const searchUsers = async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(`/api/auth/search?q=${encodeURIComponent(term)}`);
      // Filter out current user and already selected users
      const filtered = response.data.filter(
        (u) => u.id !== user?.id && !selectedUsers.find((su) => su.id === u.id)
      );
      setSearchResults(filtered);
    } catch (error) {
      console.error('Search users error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(searchTerm);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleSelectUser = (user) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
      setSearchTerm('');
      setSearchResults([]);
    }
  };

  const handleRemoveUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const handleSendInvitations = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user to invite');
      return;
    }

    try {
      setSending(true);
      const promises = selectedUsers.map((invitee) =>
        axios.post(`/api/invitations/rooms/${roomId}/invite`, {
          invitee_id: invitee.id,
          message: invitationMessage
        })
      );

      const results = await Promise.all(promises);

      // Notify via socket
      if (socket) {
        selectedUsers.forEach((invitee) => {
          socket.emit('invitation-sent', {
            invitee_id: invitee.id,
            room_id: roomId
          });
        });
      }

      // Refresh sent invitations
      await fetchSentInvitations();

      // Clear selection
      setSelectedUsers([]);
      setInvitationMessage('');
      alert(`Successfully sent ${results.length} invitation(s)!`);
    } catch (error) {
      console.error('Send invitations error:', error);
      alert('Failed to send some invitations');
    } finally {
      setSending(false);
    }
  };

  const fetchSentInvitations = async () => {
    try {
      const response = await axios.get(`/api/invitations/rooms/${roomId}/invitations`);
      setSentInvitations(response.data);
    } catch (error) {
      console.error('Fetch invitations error:', error);
    }
  };

  const handleInviteByEmail = async () => {
    const email = prompt('Enter email address to invite:');
    if (!email) return;

    try {
      setSending(true);
      await axios.post(`/api/invitations/rooms/${roomId}/invite`, {
        invitee_email: email,
        message: invitationMessage
      });

      await fetchSentInvitations();
      setInvitationMessage('');
      alert('Invitation sent!');
    } catch (error) {
      console.error('Send email invitation error:', error);
      alert(error.response?.data?.error || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="invite-users-modal">
      <div className="invite-users-content">
        <div className="invite-header">
          <h2>Invite Users to Room</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="invite-section">
          <h3>Search Users</h3>
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          {loading && <div className="loading">Searching...</div>}

          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="search-result-item"
                  onClick={() => handleSelectUser(user)}
                >
                  <div className="user-avatar">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} />
                    ) : (
                      <div className="avatar-placeholder">
                        {(user.username || 'U')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.full_name || user.username}</div>
                    <div className="user-username">@{user.username}</div>
                  </div>
                  <button className="add-btn">+</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedUsers.length > 0 && (
          <div className="selected-users-section">
            <h3>Selected Users ({selectedUsers.length})</h3>
            <div className="selected-users">
              {selectedUsers.map((user) => (
                <div key={user.id} className="selected-user-tag">
                  <span>{user.full_name || user.username}</span>
                  <button onClick={() => handleRemoveUser(user.id)}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="invite-message-section">
          <label>Optional Message:</label>
          <textarea
            value={invitationMessage}
            onChange={(e) => setInvitationMessage(e.target.value)}
            placeholder="Add a personal message to your invitation..."
            rows="3"
            className="message-textarea"
          />
        </div>

        <div className="invite-actions">
          <button onClick={handleInviteByEmail} className="btn-secondary" disabled={sending}>
            Invite by Email
          </button>
          <button
            onClick={handleSendInvitations}
            className="btn-primary"
            disabled={selectedUsers.length === 0 || sending}
          >
            {sending ? 'Sending...' : `Send Invitations (${selectedUsers.length})`}
          </button>
        </div>

        {sentInvitations.length > 0 && (
          <div className="sent-invitations-section">
            <h3>Recent Invitations</h3>
            <div className="sent-invitations-list">
              {sentInvitations.slice(0, 5).map((inv) => (
                <div key={inv.id} className="sent-invitation-item">
                  <span>
                    {inv.invitee_username || inv.invitee_email || inv.invitee_username || 'Unknown'}
                  </span>
                  <span className={`status-badge ${inv.status}`}>{inv.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteUsers;

