import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './RoomSettings.css';

const RoomSettings = ({ room, isOpen, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [backgroundLayout, setBackgroundLayout] = useState('default');
  const [backgroundPreview, setBackgroundPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const layoutOptions = [
    { value: 'default', label: 'Default', preview: '🏢' },
    { value: 'office', label: 'Office', preview: '🏛️' },
    { value: 'meeting', label: 'Meeting Room', preview: '📊' },
    { value: 'cozy', label: 'Cozy', preview: '🏠' },
    { value: 'modern', label: 'Modern', preview: '✨' },
    { value: 'custom', label: 'Custom Image', preview: '🖼️' }
  ];

  useEffect(() => {
    if (isOpen && room) {
      setBackgroundLayout(room.background_layout || 'default');
      setBackgroundPreview(room.background_image_url || null);
    }
  }, [isOpen, room]);

  // Reset preview when layout changes
  useEffect(() => {
    if (backgroundLayout !== 'custom') {
      setBackgroundPreview(null);
    } else if (room?.background_image_url) {
      setBackgroundPreview(room.background_image_url);
    }
  }, [backgroundLayout]);

  const handleLayoutChange = (layout) => {
    setBackgroundLayout(layout);
    if (layout !== 'custom') {
      setBackgroundPreview(null);
    }
  };

  const handleBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setBackgroundPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('background', file);

      const response = await axios.post(
        `/api/rooms/${room.id}/background/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setBackgroundPreview(response.data.background_image_url);
      setBackgroundLayout('custom');
      alert('Background uploaded successfully!');
    } catch (error) {
      console.error('Upload background error:', error);
      alert('Failed to upload background');
      setBackgroundPreview(room.background_image_url || null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData = {
        background_layout: backgroundLayout
      };

      // Handle background image based on layout
      if (backgroundLayout === 'custom') {
        // Keep existing image if we have one, otherwise null
        updateData.background_image_url = backgroundPreview || room?.background_image_url || null;
      } else {
        // Clear background image when switching to non-custom layout
        updateData.background_image_url = null;
      }

      console.log('Updating room with data:', updateData);

      const response = await axios.put(`/api/rooms/${room.id}/background`, updateData);

      console.log('Room update response:', response.data);

      if (onUpdate) {
        onUpdate(response.data);
      }
      alert('Room settings updated successfully!');
      onClose();
    } catch (error) {
      console.error('Update room settings error:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update room settings';
      alert(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveBackground = async () => {
    try {
      await axios.put(`/api/rooms/${room.id}/background`, {
        background_layout: 'default',
        background_image_url: null
      });

      setBackgroundLayout('default');
      setBackgroundPreview(null);

      if (onUpdate) {
        const response = await axios.get(`/api/rooms/${room.id}`);
        onUpdate(response.data);
      }

      alert('Background removed successfully!');
    } catch (error) {
      console.error('Remove background error:', error);
      alert('Failed to remove background');
    }
  };

  if (!isOpen || !room) return null;

  // Check if user is room creator
  const isCreator = room.created_by === user?.id;

  if (!isCreator) {
    return (
      <div className="room-settings-modal">
        <div className="room-settings-content">
          <div className="room-header">
            <h2>Room Settings</h2>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
          <div className="no-permission">
            <p>Only the room creator can modify room settings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="room-settings-modal">
      <div className="room-settings-content">
        <div className="room-header">
          <h2>Room Settings - {room.name}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="room-body">
          <div className="background-section">
            <label className="section-label">Background Layout</label>
            <div className="layout-options">
              {layoutOptions.map((layout) => (
                <div
                  key={layout.value}
                  className={`layout-option ${backgroundLayout === layout.value ? 'active' : ''}`}
                  onClick={() => handleLayoutChange(layout.value)}
                >
                  <div className="layout-preview">{layout.preview}</div>
                  <div className="layout-label">{layout.label}</div>
                </div>
              ))}
            </div>
          </div>

          {backgroundLayout === 'custom' && (
            <div className="custom-background-section">
              <label className="section-label">Custom Background Image</label>
              {backgroundPreview && (
                <div className="background-preview-container">
                  <img src={backgroundPreview} alt="Background preview" className="background-preview" />
                  <button onClick={handleRemoveBackground} className="remove-background-btn">
                    Remove
                  </button>
                </div>
              )}
              <label className="upload-background-btn">
                {uploading ? 'Uploading...' : backgroundPreview ? 'Change Image' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBackgroundUpload}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="upload-hint">Max size: 10MB (JPG, PNG, GIF, WebP)</p>
            </div>
          )}
        </div>

        <div className="room-actions">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoomSettings;

