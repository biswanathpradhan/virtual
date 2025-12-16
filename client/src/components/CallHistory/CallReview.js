import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './CallHistory.css';

const CallReview = ({ call, onBack }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'ended':
        return '#2196f3';
      case 'missed':
        return '#f44336';
      case 'ringing':
        return '#ff9800';
      default:
        return '#999';
    }
  };

  const getCallTypeIcon = (type) => {
    switch (type) {
      case 'audio':
        return '🎤';
      case 'video':
        return '📹';
      case 'both':
        return '📞';
      default:
        return '📞';
    }
  };

  return (
    <div className="call-review">
      <header className="review-header">
        <button onClick={onBack} className="back-btn">
          ← Back to History
        </button>
        <h1>Call Review</h1>
      </header>

      <div className="review-content">
        <div className="review-main-info">
          <div className="call-type-header">
            <span className="call-type-icon">{getCallTypeIcon(call.call_type)}</span>
            <div>
              <h2>
                {call.call_type === 'both' ? 'Audio & Video' : call.call_type === 'audio' ? 'Audio' : 'Video'} Call
              </h2>
              <span
                className="status-badge-large"
                style={{ backgroundColor: getStatusColor(call.status) }}
              >
                {call.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="call-timeline">
            <div className="timeline-item">
              <strong>Started:</strong>
              <span>{formatDate(call.started_at)}</span>
            </div>
            {call.ended_at && (
              <div className="timeline-item">
                <strong>Ended:</strong>
                <span>{formatDate(call.ended_at)}</span>
              </div>
            )}
            <div className="timeline-item">
              <strong>Duration:</strong>
              <span>{formatDuration(call.duration_seconds)}</span>
            </div>
            {call.creator_username && (
              <div className="timeline-item">
                <strong>Created by:</strong>
                <span>{call.creator_username}</span>
              </div>
            )}
          </div>
        </div>

        <div className="participants-section">
          <h3>Participants ({call.participants?.length || 0})</h3>
          <div className="participants-list">
            {call.participants && call.participants.length > 0 ? (
              call.participants.map((participant) => {
                const participantDuration = participant.duration_seconds || 0;
                const joinedAt = participant.joined_at ? new Date(participant.joined_at) : null;
                const leftAt = participant.left_at ? new Date(participant.left_at) : null;

                return (
                  <div key={participant.id} className="participant-card">
                    <div className="participant-avatar">
                      {participant.avatar_url ? (
                        <img src={participant.avatar_url} alt={participant.username} />
                      ) : (
                        <div className="avatar-placeholder">
                          {(participant.username || participant.full_name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="participant-info">
                      <h4>{participant.full_name || participant.username || 'Unknown User'}</h4>
                      <p className="participant-username">@{participant.username}</p>
                      <div className="participant-details">
                        <div className="detail-row">
                          <span>Joined:</span>
                          <span>{joinedAt ? formatDate(joinedAt) : 'N/A'}</span>
                        </div>
                        {leftAt && (
                          <div className="detail-row">
                            <span>Left:</span>
                            <span>{formatDate(leftAt)}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span>Duration:</span>
                          <span>{formatDuration(participantDuration)}</span>
                        </div>
                        <div className="detail-row">
                          <span>Audio:</span>
                          <span className={participant.audio_enabled ? 'enabled' : 'disabled'}>
                            {participant.audio_enabled ? '✓ Enabled' : '✗ Disabled'}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span>Video:</span>
                          <span className={participant.video_enabled ? 'enabled' : 'disabled'}>
                            {participant.video_enabled ? '✓ Enabled' : '✗ Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-participants">No participants found</div>
            )}
          </div>
        </div>

        {call.recordings && call.recordings.length > 0 && (
          <div className="recordings-section">
            <h3>Recordings ({call.recordings.length})</h3>
            <div className="recordings-list">
              {call.recordings.map((recording) => (
                <div key={recording.id} className="recording-item">
                  <div className="recording-info">
                    <strong>Recording</strong>
                    <span>Duration: {formatDuration(recording.duration_seconds)}</span>
                    <span>Size: {recording.file_size ? `${(recording.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}</span>
                    <span>Created: {formatDate(recording.created_at)}</span>
                  </div>
                  {recording.file_path && (
                    <a
                      href={recording.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="download-btn"
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallReview;

