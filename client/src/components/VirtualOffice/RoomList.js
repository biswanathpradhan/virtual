import React, { useState } from 'react';
import axios from 'axios';
import './RoomList.css';

const RoomList = ({ rooms, onSelectRoom, onCreateRoom }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    max_capacity: 50,
    is_private: false
  });
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/rooms', formData);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', max_capacity: 50, is_private: false });
      onCreateRoom();
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="room-list-container">
      <div className="room-list-header">
        <h2>Select a Room</h2>
        <button onClick={() => setShowCreateForm(!showCreateForm)} className="btn-create">
          {showCreateForm ? 'Cancel' : '+ Create Room'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-room-form">
          <form onSubmit={handleCreateRoom}>
            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="Enter room name"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter room description (optional)"
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Max Capacity</label>
              <input
                type="number"
                value={formData.max_capacity}
                onChange={(e) => setFormData({ ...formData, max_capacity: parseInt(e.target.value) })}
                min="2"
                max="100"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </form>
        </div>
      )}

      <div className="rooms-grid">
        {rooms.length === 0 ? (
          <div className="no-rooms">No rooms available. Create one to get started!</div>
        ) : (
          rooms.map((room) => (
            <div key={room.id} className="room-card" onClick={() => onSelectRoom(room)}>
              <div className="room-card-header">
                <h3>{room.name}</h3>
                {room.is_private && <span className="private-badge">Private</span>}
              </div>
              {room.description && <p className="room-description">{room.description}</p>}
              <div className="room-card-footer">
                <span>👥 {room.active_users || 0} active</span>
                <span>Created by {room.creator_username}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RoomList;

