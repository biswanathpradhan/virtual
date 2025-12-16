import React from 'react';
import './UserControls.css';

const UserControls = ({ 
  onStartCall, 
  onEndCall, 
  isInCall, 
  onBackToRooms,
  onStartVideoCall,
  participants
}) => {
  return (
    <div className="user-controls">
      <button onClick={onBackToRooms} className="control-btn back-btn" title="Back to Rooms">
        ← Rooms
      </button>
      
      {!isInCall ? (
        <div className="call-controls">
          <button
            onClick={() => onStartCall('audio')}
            className="control-btn audio-btn"
            title="Start Audio Call"
          >
            🎤 Audio
          </button>
          <button
            onClick={() => onStartCall('video')}
            className="control-btn video-btn"
            title="Start Video Call"
          >
            📹 Video
          </button>
          <button
            onClick={() => onStartCall('both')}
            className="control-btn both-btn"
            title="Start Audio & Video Call"
          >
            📞 Call
          </button>
          {participants && participants.length > 0 && (
            <div className="spatial-info">
              <span className="spatial-hint">💡 Spatial audio is active - move closer to hear others</span>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onEndCall}
          className="control-btn end-call-btn"
          title="End Call"
        >
          ❌ End Call
        </button>
      )}
    </div>
  );
};

export default UserControls;

