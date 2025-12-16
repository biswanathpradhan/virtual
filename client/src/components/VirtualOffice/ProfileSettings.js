import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './ProfileSettings.css';

const ProfileSettings = ({ isOpen, onClose }) => {
  const { user, setUser } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    designation: '',
    bio: ''
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setFormData({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        designation: user.designation || '',
        bio: user.bio || ''
      });
      setAvatarPreview(user.avatar_url || null);
    }
  }, [isOpen, user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await axios.post('/api/profile/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update user context
      setUser({ ...user, avatar_url: response.data.avatar_url });
      alert('Profile picture updated successfully!');
    } catch (error) {
      console.error('Upload avatar error:', error);
      alert('Failed to upload profile picture');
      setAvatarPreview(user.avatar_url || null);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Only send fields that have values or are being cleared
      const updateData = {};
      if (formData.full_name !== undefined) updateData.full_name = formData.full_name || null;
      if (formData.phone_number !== undefined) updateData.phone_number = formData.phone_number || null;
      if (formData.designation !== undefined) updateData.designation = formData.designation || null;
      if (formData.bio !== undefined) updateData.bio = formData.bio || null;

      const response = await axios.put('/api/profile/profile', updateData);

      // Update user context
      setUser({ ...user, ...response.data });
      alert('Profile updated successfully!');
      onClose();
    } catch (error) {
      console.error('Update profile error:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update profile';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profile-settings-modal">
      <div className="profile-settings-content">
        <div className="profile-header">
          <h2>Profile Settings</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="profile-body">
          <div className="avatar-section">
            <label className="avatar-label">Profile Picture</label>
            <div className="avatar-container">
              <div className="avatar-preview">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    {(user?.username || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <label className="avatar-upload-btn">
                {uploading ? 'Uploading...' : 'Change Picture'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  disabled={uploading}
                  style={{ display: 'none' }}
                />
              </label>
              <p className="avatar-hint">Max size: 5MB (JPG, PNG, GIF, WebP)</p>
            </div>
          </div>

          <div className="form-section">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Enter your full name"
              />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                placeholder="Enter your phone number"
              />
            </div>

            <div className="form-group">
              <label>Designation</label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleInputChange}
                placeholder="e.g., Software Engineer, Manager, etc."
              />
            </div>

            <div className="form-group">
              <label>Bio</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell us about yourself..."
                rows="4"
                maxLength="500"
              />
              <span className="char-count">{formData.bio.length}/500</span>
            </div>
          </div>
        </div>

        <div className="profile-actions">
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

export default ProfileSettings;

