import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './FilePanel.css';

const FilePanel = ({ roomId, isOpen, onClose }) => {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (roomId && isOpen) {
      fetchFiles();
    }
  }, [roomId, isOpen]);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/files/rooms/${roomId}/files`);
      setFiles(response.data);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(
        `/api/files/rooms/${roomId}/files`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setFiles((prev) => [response.data, ...prev]);
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const response = await axios.get(`/api/files/${fileId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download file:', error);
      alert('Failed to download file');
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    try {
      await axios.delete(`/api/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error('Failed to delete file:', error);
      alert('Failed to delete file');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="file-panel">
      <div className="file-header">
        <h3>Files</h3>
        <button onClick={onClose} className="file-close-btn">×</button>
      </div>

      <div className="file-upload-section">
        <label className="file-upload-btn">
          {uploading ? 'Uploading...' : '+ Upload File'}
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <div className="file-list">
        {loading ? (
          <div className="file-loading">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="file-empty">No files shared yet</div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="file-item">
              <div className="file-info">
                <div className="file-icon">
                  {file.file_type === '.pdf' ? '📄' :
                   file.file_type === '.doc' || file.file_type === '.docx' ? '📝' :
                   file.file_type === '.jpg' || file.file_type === '.png' || file.file_type === '.gif' ? '🖼️' :
                   file.file_type === '.mp4' || file.file_type === '.avi' ? '🎥' :
                   '📎'}
                </div>
                <div className="file-details">
                  <div className="file-name">{file.file_name}</div>
                  <div className="file-meta">
                    {formatFileSize(file.file_size)} • {file.username} • {formatDate(file.uploaded_at)}
                  </div>
                </div>
              </div>
              <div className="file-actions">
                <button
                  onClick={() => handleDownload(file.id, file.file_name)}
                  className="file-action-btn"
                  title="Download"
                >
                  ⬇️
                </button>
                {(file.user_id === user?.id) && (
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="file-action-btn delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FilePanel;

