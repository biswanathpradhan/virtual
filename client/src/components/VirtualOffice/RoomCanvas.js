import React, { useRef, useEffect, useState } from 'react';
import './RoomCanvas.css';

const RoomCanvas = ({ participants, myPosition, onPositionChange, currentUser, room }) => {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const userImagesRef = useRef(new Map()); // Cache loaded images

  // Load user images
  useEffect(() => {
    const allUsers = [...participants, currentUser].filter(Boolean);
    allUsers.forEach((user) => {
      if (user?.avatar_url && !userImagesRef.current.has(user.avatar_url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          userImagesRef.current.set(user.avatar_url, img);
          // Trigger redraw
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            
            // Apply zoom and pan transformations
            ctx.save();
            ctx.translate(pan.x, pan.y);
            ctx.scale(zoom, zoom);
            
            const visibleWidth = canvas.width / zoom;
            const visibleHeight = canvas.height / zoom;
            const offsetX = -pan.x / zoom;
            const offsetY = -pan.y / zoom;
            
            redrawCanvas(ctx, visibleWidth, visibleHeight, offsetX, offsetY);
            ctx.restore();
          }
        };
        img.onerror = () => {
          userImagesRef.current.set(user.avatar_url, null);
          // Redraw even on error to show placeholder
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            
            ctx.save();
            ctx.translate(pan.x, pan.y);
            ctx.scale(zoom, zoom);
            
            const visibleWidth = canvas.width / zoom;
            const visibleHeight = canvas.height / zoom;
            const offsetX = -pan.x / zoom;
            const offsetY = -pan.y / zoom;
            
            redrawCanvas(ctx, visibleWidth, visibleHeight, offsetX, offsetY);
            ctx.restore();
          }
        };
        img.src = user.avatar_url;
      }
    });
  }, [participants, currentUser]);

  const redrawCanvas = (ctx, width, height, offsetX = 0, offsetY = 0) => {
    // Clear the entire visible area
    ctx.clearRect(0, 0, width, height);

    // Draw background covering full area
    if (room?.background_image_url) {
      const bgImage = new Image();
      bgImage.crossOrigin = 'anonymous';
      bgImage.onload = () => {
        // Draw background to cover full canvas area
        ctx.drawImage(bgImage, 0, 0, width, height);
        drawGrid(ctx, width, height, 0, 0);
        drawAllParticipants(ctx);
      };
      bgImage.onerror = () => {
        drawBackgroundLayout(ctx, width, height, room?.background_layout || 'default');
        drawGrid(ctx, width, height, 0, 0);
        drawAllParticipants(ctx);
      };
      bgImage.src = room.background_image_url;
    } else {
      drawBackgroundLayout(ctx, width, height, room?.background_layout || 'default');
      drawGrid(ctx, width, height, 0, 0);
      drawAllParticipants(ctx);
    }
  };

  const drawAllParticipants = (ctx) => {
    // Draw other participants
    participants.forEach((participant) => {
      if (participant.user_id !== currentUser?.id) {
        drawUser(ctx, participant, participant.position_x || 0, participant.position_y || 0, false);
      }
    });

    // Draw current user
    drawUser(ctx, currentUser, myPosition.x, myPosition.y, true);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Apply zoom and pan transformations
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);
    
    // Use full canvas dimensions for drawing (scaled by zoom)
    const visibleWidth = canvas.width / zoom;
    const visibleHeight = canvas.height / zoom;

    redrawCanvas(ctx, visibleWidth, visibleHeight, 0, 0);
    ctx.restore();
  }, [participants, myPosition, currentUser, room, zoom, pan]);

  const drawBackgroundLayout = (ctx, width, height, layout) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    
    switch (layout) {
      case 'office':
        gradient.addColorStop(0, '#e8f4f8');
        gradient.addColorStop(1, '#c8e6f5');
        break;
      case 'meeting':
        gradient.addColorStop(0, '#f5f5f5');
        gradient.addColorStop(1, '#e0e0e0');
        break;
      case 'cozy':
        gradient.addColorStop(0, '#fff8e1');
        gradient.addColorStop(1, '#ffe082');
        break;
      case 'modern':
        gradient.addColorStop(0, '#f3e5f5');
        gradient.addColorStop(1, '#e1bee7');
        break;
      default:
        gradient.addColorStop(0, '#f0f0f0');
        gradient.addColorStop(1, '#e0e0e0');
    }
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const drawGrid = (ctx, width, height, offsetX = 0, offsetY = 0) => {
    ctx.strokeStyle = 'rgba(224, 224, 224, 0.5)';
    ctx.lineWidth = 1;

    const gridSize = 50;
    
    // Draw grid covering full canvas area
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Load user images
  useEffect(() => {
    const allUsers = [...participants, currentUser].filter(Boolean);
    allUsers.forEach((user) => {
      if (user.avatar_url && !userImagesRef.current.has(user.avatar_url)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          userImagesRef.current.set(user.avatar_url, img);
          // Trigger redraw
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            redrawCanvas(ctx, canvas.width, canvas.height);
          }
        };
        img.onerror = () => {
          userImagesRef.current.set(user.avatar_url, null);
          // Redraw even on error to show placeholder
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            redrawCanvas(ctx, canvas.width, canvas.height);
          }
        };
        img.src = user.avatar_url;
      }
    });
  }, [participants, currentUser]);

  const drawUser = (ctx, user, x, y, isCurrentUser) => {
    if (!user) return;

    const size = isCurrentUser ? 60 : 50;
    const color = isCurrentUser ? '#667eea' : '#4caf50';
    const borderWidth = isCurrentUser ? 4 : 3;

    // Draw profile image if available and loaded
    if (user.avatar_url) {
      const img = userImagesRef.current.get(user.avatar_url);
      if (img && img.complete && img.naturalHeight !== 0) {
        // Draw circular clipping path
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.clip();
        
        // Draw image
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        ctx.restore();
        
        // Draw border
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.strokeStyle = isCurrentUser ? '#764ba2' : '#2e7d32';
        ctx.lineWidth = borderWidth;
        ctx.stroke();
      } else {
        // Image not loaded yet or failed, draw placeholder
        drawUserPlaceholder(ctx, user, x, y, size, color, isCurrentUser);
      }
    } else {
      // No avatar, draw placeholder circle with initial
      drawUserPlaceholder(ctx, user, x, y, size, color, isCurrentUser);
    }

    // Draw status indicator (green if active in room)
    const isActive = user.status === 'online' || user.status === 'active';
    const statusColors = {
      online: '#4caf50',
      active: '#4caf50', // Green for active
      away: '#ff9800',
      busy: '#f44336',
      offline: '#ccc'
    };
    ctx.beginPath();
    ctx.arc(x + size / 2 - 10, y - size / 2 + 10, 7, 0, Math.PI * 2);
    ctx.fillStyle = statusColors[user.status] || (isActive ? '#4caf50' : '#ccc');
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Always draw name and designation after drawing the avatar
    drawUserInfo(ctx, user, x, y, size);
  };

  const drawUserPlaceholder = (ctx, user, x, y, size, color, isCurrentUser) => {
    // Draw circle background
    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = isCurrentUser ? '#764ba2' : '#2e7d32';
    ctx.lineWidth = isCurrentUser ? 4 : 3;
    ctx.stroke();

    // Draw initial letter
    const initial = (user.full_name || user.username || 'U')[0].toUpperCase();
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size / 2.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, x, y);

    // Draw name and designation
    drawUserInfo(ctx, user, x, y, size);
  };

  const drawUserInfo = (ctx, user, x, y, size) => {
    const name = user.full_name || user.username || 'User';
    const designation = user.designation || '';
    const textY = y + size / 2 + 18;

    // Draw name with background for readability
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // Measure text for background
    const nameMetrics = ctx.measureText(name);
    const nameWidth = nameMetrics.width;
    const nameHeight = 16;
    
    // Draw background for name (with padding)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x - nameWidth / 2 - 6, textY - 3, nameWidth + 12, nameHeight + 2);
    
    // Draw border for name background
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - nameWidth / 2 - 6, textY - 3, nameWidth + 12, nameHeight + 2);
    
    // Draw name
    ctx.fillStyle = '#333';
    ctx.fillText(name, x, textY);

    // Draw designation if available
    if (designation) {
      ctx.font = '11px Arial';
      ctx.fillStyle = '#666';
      const desigMetrics = ctx.measureText(designation);
      const desigWidth = desigMetrics.width;
      const desigHeight = 14;
      const desigY = textY + nameHeight + 4;
      
      // Draw background for designation
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(x - desigWidth / 2 - 6, desigY - 2, desigWidth + 12, desigHeight + 2);
      
      // Draw border for designation background
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - desigWidth / 2 - 6, desigY - 2, desigWidth + 12, desigHeight + 2);
      
      // Draw designation
      ctx.fillStyle = '#666';
      ctx.fillText(designation, x, desigY);
    }
  };

  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Account for zoom and pan
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const distance = Math.sqrt(
      Math.pow(x - myPosition.x, 2) + Math.pow(y - myPosition.y, 2)
    );

    if (distance <= 35) {
      setIsDragging(true);
      setDragOffset({
        x: x - myPosition.x,
        y: y - myPosition.y
      });
    } else if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
      // Pan the canvas if clicking on empty space
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left - pan.x,
        y: e.clientY - rect.top - pan.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Check if we're dragging the user or panning
    const distance = Math.sqrt(
      Math.pow((e.clientX - rect.left - pan.x) / zoom - myPosition.x, 2) +
      Math.pow((e.clientY - rect.top - pan.y) / zoom - myPosition.y, 2)
    );

    if (distance <= 50) {
      // Dragging user avatar
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      const newX = Math.max(35, Math.min(x, (canvas.width / zoom) - 35));
      const newY = Math.max(35, Math.min(y, (canvas.height / zoom) - 35));

      onPositionChange({ x: newX, y: newY });
    } else {
      // Panning the canvas
      const newPanX = e.clientX - rect.left - dragOffset.x;
      const newPanY = e.clientY - rect.top - dragOffset.y;
      setPan({ x: newPanX, y: newPanY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitToView = () => {
    // Calculate bounds of all participants
    const allPositions = [
      myPosition,
      ...participants.map(p => ({ x: p.position_x || 0, y: p.position_y || 0 }))
    ].filter(p => p.x > 0 && p.y > 0);

    if (allPositions.length === 0) {
      handleZoomReset();
      return;
    }

    const minX = Math.min(...allPositions.map(p => p.x));
    const maxX = Math.max(...allPositions.map(p => p.x));
    const minY = Math.min(...allPositions.map(p => p.y));
    const maxY = Math.max(...allPositions.map(p => p.y));

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = maxX - minX + 200; // Add padding
    const height = maxY - minY + 200;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const scaleX = canvas.width / width;
    const scaleY = canvas.height / height;
    const newZoom = Math.min(scaleX, scaleY, 2); // Max zoom 2x

    const newPanX = canvas.width / 2 - centerX * newZoom;
    const newPanY = canvas.height / 2 - centerY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  };

  return (
    <div className="room-canvas-container">
      <div className="zoom-controls">
        <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">+</button>
        <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">−</button>
        <button onClick={handleZoomReset} className="zoom-btn" title="Reset Zoom">⌂</button>
        <button onClick={handleFitToView} className="zoom-btn" title="Fit All Users">👁️</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
      </div>
      <canvas
        ref={canvasRef}
        className="room-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};

export default RoomCanvas;

