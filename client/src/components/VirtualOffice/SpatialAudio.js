import React, { useEffect, useRef, useState } from 'react';
import './SpatialAudio.css';

const SpatialAudio = ({ 
  participants, 
  myPosition, 
  currentUser, 
  roomId, 
  socket,
  isMuted,
  onMuteChange
}) => {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const peerConnections = useRef(new Map());
  const audioElements = useRef(new Map());
  const videoElements = useRef(new Map());
  const audioContextRef = useRef(null);
  const pannerNodes = useRef(new Map());
  const gainNodes = useRef(new Map());
  const lastActivityTime = useRef(Date.now());
  const activityCheckInterval = useRef(null);

  // Maximum distance for audio (pixels)
  const MAX_AUDIO_DISTANCE = 300;
  const MIN_VOLUME = 0;
  const MAX_VOLUME = 1;

  useEffect(() => {
    initializeAudio();
    setupActivityTracking();

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (localStream && socket) {
      setupSocketListeners();
    }

    return () => {
      if (socket) {
        socket.off('spatial-audio-offer');
        socket.off('spatial-audio-answer');
        socket.off('spatial-audio-ice-candidate');
        socket.off('spatial-audio-stream');
        socket.off('user-muted');
        socket.off('user-unmuted');
      }
    };
  }, [localStream, socket]);

  useEffect(() => {
    // Update audio volumes based on positions
    updateAudioVolumes();
  }, [participants, myPosition]);

  useEffect(() => {
    // Handle mute state
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted && isAudioEnabled;
      });
    }
  }, [isMuted, isAudioEnabled, localStream]);

  const initializeAudio = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      setLocalStream(stream);

      // Create AudioContext for spatial audio processing
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

      // Notify others that we're ready
      if (socket) {
        socket.emit('spatial-audio-ready', { roomId });
      }
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Microphone access is required for spatial audio. Please allow microphone access.');
    }
  };

  const setupActivityTracking = () => {
    // Track user activity
    const trackActivity = () => {
      lastActivityTime.current = Date.now();
      
      // Emit activity update
      if (socket) {
        socket.emit('user-activity', { roomId });
      }
    };

    // Track mouse movement, clicks, keyboard, etc.
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, trackActivity, { passive: true });
    });

    // Check for inactivity every minute
    activityCheckInterval.current = setInterval(() => {
      const inactiveTime = Date.now() - lastActivityTime.current;
      const INACTIVE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

      if (inactiveTime > INACTIVE_THRESHOLD && socket) {
        socket.emit('user-inactive', { roomId });
        // Update status to away/offline
        if (socket) {
          socket.emit('update-status', { status: 'away' });
        }
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, trackActivity);
      });
      if (activityCheckInterval.current) {
        clearInterval(activityCheckInterval.current);
      }
    };
  };

  const setupSocketListeners = () => {
    if (!socket) return;

    socket.on('spatial-audio-offer', async (data) => {
      const { fromUserId, offer } = data;
      await handleOffer(fromUserId, offer);
    });

    socket.on('spatial-audio-answer', async (data) => {
      const { fromUserId, answer } = data;
      await handleAnswer(fromUserId, answer);
    });

    socket.on('spatial-audio-ice-candidate', async (data) => {
      const { fromUserId, candidate } = data;
      await handleIceCandidate(fromUserId, candidate);
    });

    socket.on('user-muted', (data) => {
      const { userId } = data;
      const audioElement = audioElements.current.get(userId);
      if (audioElement) {
        audioElement.muted = true;
      }
    });

    socket.on('user-unmuted', (data) => {
      const { userId } = data;
      const audioElement = audioElements.current.get(userId);
      if (audioElement) {
        audioElement.muted = false;
      }
    });
  };

  const createPeerConnection = async (userId) => {
    if (peerConnections.current.has(userId) || !localStream) {
      return;
    }

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];

    const pc = new RTCPeerConnection({ iceServers });

    // Add local audio track
    localStream.getAudioTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      handleRemoteStream(userId, remoteStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('spatial-audio-ice-candidate', {
          toUserId: userId,
          candidate: event.candidate,
          roomId
        });
      }
    };

    peerConnections.current.set(userId, pc);

    // Create offer
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('spatial-audio-offer', {
          toUserId: userId,
          offer: offer,
          roomId
        });
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  };

  const handleOffer = async (fromUserId, offer) => {
    if (!localStream) return;

    let pc = peerConnections.current.get(fromUserId);
    if (!pc) {
      const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];

      pc = new RTCPeerConnection({ iceServers });

      localStream.getAudioTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        handleRemoteStream(fromUserId, remoteStream);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('spatial-audio-ice-candidate', {
            toUserId: fromUserId,
            candidate: event.candidate,
            roomId
          });
        }
      };

      peerConnections.current.set(fromUserId, pc);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('spatial-audio-answer', {
          toUserId: fromUserId,
          answer: answer,
          roomId
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (fromUserId, answer) => {
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  const handleIceCandidate = async (fromUserId, candidate) => {
    const pc = peerConnections.current.get(fromUserId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  const handleRemoteStream = (userId, stream) => {
    // Create audio element for this user
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;
    audioElement.srcObject = stream;
    audioElements.current.set(userId, audioElement);

    // Create spatial audio processing
    if (audioContextRef.current) {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const panner = audioContextRef.current.createPanner();
      const gain = audioContextRef.current.createGain();

      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 50;
      panner.maxDistance = MAX_AUDIO_DISTANCE;
      panner.rolloffFactor = 1;

      source.connect(panner);
      panner.connect(gain);
      gain.connect(audioContextRef.current.destination);

      pannerNodes.current.set(userId, panner);
      gainNodes.current.set(userId, gain);
    }

    // Update volumes based on current positions
    updateAudioVolumes();
  };

  const calculateDistance = (pos1, pos2) => {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
  };

  const updateAudioVolumes = () => {
    if (!audioContextRef.current) return;

    participants.forEach((participant) => {
      if (participant.user_id === currentUser?.id) return;

      const distance = calculateDistance(
        myPosition,
        { x: participant.position_x || 0, y: participant.position_y || 0 }
      );

      const panner = pannerNodes.current.get(participant.user_id);
      const gain = gainNodes.current.get(participant.user_id);

      if (panner && gain) {
        // Calculate volume based on distance
        let volume = 1;
        if (distance > MAX_AUDIO_DISTANCE) {
          volume = MIN_VOLUME;
        } else {
          // Linear volume falloff
          volume = 1 - (distance / MAX_AUDIO_DISTANCE);
          volume = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));
        }

        gain.gain.value = volume;

        // Update 3D position for spatial audio
        const relativeX = (participant.position_x || 0) - myPosition.x;
        const relativeY = (participant.position_y || 0) - myPosition.y;
        
        panner.positionX.value = relativeX / 100; // Scale down for audio context
        panner.positionY.value = 0; // Keep on same plane
        panner.positionZ.value = relativeY / 100;
      }
    });
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    onMuteChange(newMutedState);

    if (socket) {
      socket.emit(newMutedState ? 'spatial-audio-mute' : 'spatial-audio-unmute', { roomId });
    }
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Add video track to existing peer connections
        peerConnections.current.forEach((pc) => {
          videoStream.getVideoTracks().forEach(track => {
            pc.addTrack(track, videoStream);
          });
        });
        setIsVideoEnabled(true);
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    } else {
      // Stop video tracks
      if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
      }
      setIsVideoEnabled(false);
    }
  };

  const cleanup = () => {
    // Close all peer connections
    peerConnections.current.forEach((pc) => {
      pc.close();
    });
    peerConnections.current.clear();

    // Stop all audio elements
    audioElements.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    audioElements.current.clear();

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    // Clear intervals
    if (activityCheckInterval.current) {
      clearInterval(activityCheckInterval.current);
    }
  };

  // Create peer connections for nearby users
  useEffect(() => {
    if (!localStream || !socket) return;

    participants.forEach((participant) => {
      if (participant.user_id === currentUser?.id) return;

      const distance = calculateDistance(
        myPosition,
        { x: participant.position_x || 0, y: participant.position_y || 0 }
      );

      // Only create connection for users within audio range
      if (distance <= MAX_AUDIO_DISTANCE) {
        if (!peerConnections.current.has(participant.user_id)) {
          createPeerConnection(participant.user_id);
        }
      } else {
        // Close connection if user is too far
        const pc = peerConnections.current.get(participant.user_id);
        if (pc) {
          pc.close();
          peerConnections.current.delete(participant.user_id);
          
          // Remove audio element
          const audio = audioElements.current.get(participant.user_id);
          if (audio) {
            audio.pause();
            audio.srcObject = null;
            audioElements.current.delete(participant.user_id);
          }
        }
      }
    });
  }, [participants, myPosition, localStream, socket]);

  return (
    <div className="spatial-audio-controls">
      <button
        onClick={toggleMute}
        className={`audio-control-btn ${isMuted ? 'muted' : ''}`}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>
      {isVideoEnabled && (
        <button
          onClick={toggleVideo}
          className="audio-control-btn"
          title="Turn off video"
        >
          📹
        </button>
      )}
    </div>
  );
};

export default SpatialAudio;

