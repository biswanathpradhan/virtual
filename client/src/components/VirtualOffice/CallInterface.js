import React, { useEffect, useRef, useState } from 'react';
import './CallInterface.css';

const CallInterface = ({ call, onEndCall, socket, currentUser }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const remoteScreenRefs = useRef(new Map());
  const peerConnections = useRef(new Map());

  useEffect(() => {
    initializeCall();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const initializeCall = async () => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: call.call_type !== 'audio'
      });

      setLocalStream(stream);

      // Set up WebRTC signaling listeners
      if (socket) {
        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);
        socket.on('call-answered', handleCallAnswered);
        socket.on('call-ended', handleCallEnded);
        socket.on('screen-share-started', handleScreenShareStarted);
        socket.on('screen-share-stopped', handleScreenShareStopped);
      }

      // Create peer connections for other participants
      if (call.participants) {
        call.participants.forEach((participant) => {
          if (participant.user_id !== currentUser?.id) {
            createPeerConnection(participant.user_id, stream);
          }
        });
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Failed to access camera/microphone. Please check permissions.');
    }
  };

  const handleCallAnswered = (data) => {
    // When someone answers, create peer connection if not exists
    if (localStream && data.user.id !== currentUser?.id) {
      const userId = data.user.id;
      if (!peerConnections.current.has(userId)) {
        createPeerConnection(userId, localStream);
      }
    }
  };

  const handleCallEnded = (data) => {
    // Clean up peer connection when call ends
    const userId = data.user.id;
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }

    // Remove remote stream
    setRemoteStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
  };

  const createPeerConnection = (userId, localStream) => {
    // Check if connection already exists
    if (peerConnections.current.has(userId)) {
      return;
    }

    // Get TURN server config from environment or use defaults
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Add TURN server if configured
    if (process.env.REACT_APP_TURN_SERVER) {
      iceServers.push({
        urls: process.env.REACT_APP_TURN_SERVER,
        username: process.env.REACT_APP_TURN_USERNAME || '',
        credential: process.env.REACT_APP_TURN_PASSWORD || ''
      });
    }

    const configuration = {
      iceServers
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams((prev) => {
        const newMap = new Map(prev);
        newMap.set(userId, remoteStream);
        return newMap;
      });

      // Set video element
      setTimeout(() => {
        const videoElement = remoteVideoRefs.current.get(userId);
        if (videoElement) {
          videoElement.srcObject = remoteStream;
        }
      }, 100);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc-ice-candidate', {
          targetUserId: userId,
          candidate: event.candidate,
          roomId: call.room_id
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${userId}:`, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        // Try to reconnect
        setTimeout(() => {
          if (peerConnections.current.has(userId)) {
            createPeerConnection(userId, localStream);
          }
        }, 2000);
      }
    };

    peerConnections.current.set(userId, pc);

    // Create and send offer
    pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: call.call_type !== 'audio'
    })
      .then((offer) => {
        return pc.setLocalDescription(offer);
      })
      .then(() => {
        if (socket) {
          socket.emit('webrtc-offer', {
            targetUserId: userId,
            offer: pc.localDescription,
            roomId: call.room_id
          });
        }
      })
      .catch((error) => {
        console.error('Error creating offer:', error);
      });
  };

  const handleOffer = async (data) => {
    const { fromUserId, offer } = data;

    if (!localStream) return;

    let pc = peerConnections.current.get(fromUserId);

    if (!pc) {
      pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStreams((prev) => {
          const newMap = new Map(prev);
          newMap.set(fromUserId, remoteStream);
          return newMap;
        });

        setTimeout(() => {
          const videoElement = remoteVideoRefs.current.get(fromUserId);
          if (videoElement) {
            videoElement.srcObject = remoteStream;
          }
        }, 100);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('webrtc-ice-candidate', {
            targetUserId: fromUserId,
            candidate: event.candidate,
            roomId: call.room_id
          });
        }
      };

      peerConnections.current.set(fromUserId, pc);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    if (socket) {
      socket.emit('webrtc-answer', {
        targetUserId: fromUserId,
        answer: pc.localDescription,
        roomId: call.room_id
      });
    }
  };

  const handleAnswer = async (data) => {
    const { fromUserId, answer } = data;
    const pc = peerConnections.current.get(fromUserId);

    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (data) => {
    const { fromUserId, candidate } = data;
    const pc = peerConnections.current.get(fromUserId);

    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const toggleAudio = async () => {
    if (localStream) {
      const newMutedState = !isAudioMuted;
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = newMutedState;
      });
      setIsAudioMuted(newMutedState);

      // Update in database if call exists
      if (call?.id && socket) {
        try {
          await fetch(`/api/calls/${call.id}/participant`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              audio_enabled: newMutedState,
              video_enabled: !isVideoOff
            })
          });
        } catch (error) {
          console.error('Failed to update audio settings:', error);
        }
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const newVideoState = !isVideoOff;
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = newVideoState;
      });
      setIsVideoOff(newVideoState);

      // Update in database if call exists
      if (call?.id && socket) {
        try {
          await fetch(`/api/calls/${call.id}/participant`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              audio_enabled: !isAudioMuted,
              video_enabled: newVideoState
            })
          });
        } catch (error) {
          console.error('Failed to update video settings:', error);
        }
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }

      // Add screen track to all peer connections
      peerConnections.current.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
          }
        });
      });

      // Notify via socket
      if (socket) {
        socket.emit('screen-share-start', {
          callId: call.id,
          roomId: call.room_id
        });
      }

      // Stop screen share when user stops sharing
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Failed to start screen sharing');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    // Restore camera track
    if (localStream) {
      peerConnections.current.forEach((pc) => {
        localStream.getVideoTracks().forEach((track) => {
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(track);
          }
        });
      });
    }

    // Notify via socket
    if (socket) {
      socket.emit('screen-share-stop', {});
    }
  };

  const handleScreenShareStarted = (data) => {
    // Handle remote screen share started
    console.log('Screen share started by:', data.user.username);
  };

  const handleScreenShareStopped = (data) => {
    // Handle remote screen share stopped
    console.log('Screen share stopped by:', data.userId);
    setRemoteScreenStreams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(data.userId);
      return newMap;
    });
  };

  const cleanup = () => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => {
      pc.close();
    });
    peerConnections.current.clear();

    // Clear remote streams
    setRemoteStreams(new Map());
    setRemoteScreenStreams(new Map());

    // Remove socket listeners
    if (socket) {
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-ice-candidate');
      socket.off('call-answered');
      socket.off('call-ended');
      socket.off('screen-share-started');
      socket.off('screen-share-stopped');
    }
  };

  const participants = call.participants || [];

  return (
    <div className="call-interface">
      <div className="call-header">
        <h3>Call in Progress</h3>
        <button onClick={onEndCall} className="end-call-btn-small">End Call</button>
      </div>

      <div className="video-grid">
        {/* Local video */}
        <div className="video-container local-video">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={isVideoOff ? 'video-off' : ''}
          />
          <div className="video-label">You</div>
          {isVideoOff && <div className="video-placeholder">📹</div>}
        </div>

        {/* Remote videos */}
        {Array.from(remoteStreams.entries()).map(([userId, stream]) => {
          const participant = participants.find((p) => p.user_id === userId);
          return (
            <div key={userId} className="video-container remote-video">
              <video
                ref={(el) => {
                  if (el) remoteVideoRefs.current.set(userId, el);
                }}
                autoPlay
                playsInline
              />
              <div className="video-label">
                {participant?.username || participant?.full_name || 'User'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="call-controls">
        <button
          onClick={toggleAudio}
          className={`control-btn ${isAudioMuted ? 'muted' : ''}`}
          title={isAudioMuted ? 'Unmute' : 'Mute'}
        >
          {isAudioMuted ? '🔇' : '🎤'}
        </button>
        <button
          onClick={toggleVideo}
          className={`control-btn ${isVideoOff ? 'off' : ''}`}
          title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
        >
          {isVideoOff ? '📵' : '📹'}
        </button>
        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          className={`control-btn ${isScreenSharing ? 'active' : ''}`}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          {isScreenSharing ? '🛑' : '🖥️'}
        </button>
        <button onClick={onEndCall} className="control-btn end-btn" title="End Call">
          ❌
        </button>
      </div>
    </div>
  );
};

export default CallInterface;

