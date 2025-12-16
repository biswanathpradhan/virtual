import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import CallReview from './CallReview';
import './CallHistory.css';

const CallHistory = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' or 'me'

  useEffect(() => {
    fetchCallHistory();
  }, [filter]);

  const fetchCallHistory = async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'me' ? '/api/calls/history/me' : '/api/calls/history/all';
      const response = await axios.get(endpoint);
      setCalls(response.data);
    } catch (error) {
      console.error('Failed to fetch call history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReview = async (callId) => {
    try {
      const response = await axios.get(`/api/calls/${callId}/review`);
      setSelectedCall(response.data);
    } catch (error) {
      console.error('Failed to fetch call review:', error);
      alert('Failed to load call details');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'ended':
        return '#2196f3';
      case 'missed':
        return '#f44336';
      default:
        return '#999';
    }
  };

  if (selectedCall) {
    return (
      <CallReview
        call={selectedCall}
        onBack={() => setSelectedCall(null)}
      />
    );
  }

  return (
    <div className="call-history">
      <header className="history-header">
        <div className="header-left">
          <button onClick={() => navigate('/office')} className="back-btn">
            ← Back to Office
          </button>
          <h1>Call History</h1>
        </div>
        <div className="header-right">
          <div className="filter-buttons">
            <button
              onClick={() => setFilter('all')}
              className={filter === 'all' ? 'active' : ''}
            >
              All Calls
            </button>
            <button
              onClick={() => setFilter('me')}
              className={filter === 'me' ? 'active' : ''}
            >
              My Calls
            </button>
          </div>
          <div className="user-info">
            <span>{user?.username}</span>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <div className="history-content">
        {loading ? (
          <div className="loading">Loading call history...</div>
        ) : calls.length === 0 ? (
          <div className="no-calls">No call history found</div>
        ) : (
          <div className="calls-list">
            {calls.map((call) => (
              <div key={call.id} className="call-item">
                <div className="call-main-info">
                  <div className="call-header-info">
                    <h3>
                      {call.call_type === 'audio' ? '🎤' : call.call_type === 'video' ? '📹' : '📞'} 
                      {' '}
                      {call.call_type === 'both' ? 'Audio & Video' : call.call_type === 'audio' ? 'Audio' : 'Video'} Call
                    </h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(call.status) }}
                    >
                      {call.status}
                    </span>
                  </div>
                  <div className="call-details">
                    <div className="detail-item">
                      <strong>Started:</strong> {formatDate(call.started_at)}
                    </div>
                    {call.ended_at && (
                      <div className="detail-item">
                        <strong>Ended:</strong> {formatDate(call.ended_at)}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Duration:</strong> {formatDuration(call.duration_seconds)}
                    </div>
                    <div className="detail-item">
                      <strong>Participants:</strong> {call.participant_count || 0}
                    </div>
                    {call.creator_username && (
                      <div className="detail-item">
                        <strong>Created by:</strong> {call.creator_username}
                      </div>
                    )}
                  </div>
                </div>
                <div className="call-actions">
                  <button
                    onClick={() => handleViewReview(call.id)}
                    className="btn-review"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallHistory;

