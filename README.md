# Virtual Office Platform

An interactive, real-time digital workspace where users can see other participants live, manage their availability and settings, and communicate through audio and video calls. The virtual office visually represents active users in shared spaces and enables seamless interaction.

## Features

- **Live Presence Visibility**: See all active users in real-time within shared virtual rooms
- **Interactive Workspace**: Drag and drop your avatar to move around the virtual office
- **Audio/Video Calls**: Start audio-only, video-only, or combined calls with room participants
- **Screen Sharing**: Share your screen during calls for presentations and collaboration
- **Real-time Chat**: Text messaging in rooms with instant delivery
- **File Sharing**: Upload and share files with room participants
- **Call Recording**: Record calls with metadata storage (recording files can be stored)
- **User Invitations**: Invite users to rooms by username, email, or search
- **Real-time Notifications**: Get instant notifications for new invitations
- **User Profiles**: Complete profile management with picture upload, phone number, designation, and bio
- **Room Customization**: Customize room backgrounds with preset layouts or custom images
- **Call History & Review**: View detailed call history with participant information, duration, and recordings
- **User Settings**: Manage audio/video preferences, notifications, and theme
- **Real-time Updates**: Instant updates when users join/leave rooms or change positions
- **Secure Connections**: JWT-based authentication and encrypted WebRTC connections
- **TURN Server Support**: Configurable TURN servers for better connectivity behind firewalls
- **Database Storage**: All call data, participants, chat, files, and history stored in MySQL database

## Tech Stack

### Backend
- Node.js with Express
- Socket.io for real-time communication
- MySQL database
- JWT authentication
- WebRTC signaling server

### Frontend
- React 18
- Socket.io-client
- WebRTC for peer-to-peer communication
- Axios for API calls
- React Router for navigation

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Virtual-Office
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   PORT=5000
   CLIENT_URL=http://localhost:3000
   
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=virtual_office
   
   JWT_SECRET=your-secret-key-change-this-in-production
   ```

4. **Initialize the database**
   
   The database will be automatically created and initialized when you start the server. Make sure MySQL is running and the credentials in `.env` are correct.

5. **Start the application**
   
   ```bash
   # Start both server and client
   npm run dev
   
   # Or start separately:
   # Terminal 1 - Server
   npm run server
   
   # Terminal 2 - Client
   npm run client
   ```

6. **Access the application**
   
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Health Check: http://localhost:5000/api/health

## Database Schema

The application uses the following main tables:

- **users**: User accounts and authentication
- **rooms**: Virtual office rooms
- **room_presence**: User positions and status in rooms
- **calls**: Call records with metadata
- **call_participants**: Individual participant data for each call
- **user_settings**: User preferences and settings
- **call_recordings**: Call recording metadata and file paths
- **room_messages**: Chat messages in rooms
- **room_files**: Shared files in rooms
- **screen_sharing_sessions**: Active screen sharing sessions
- **room_invitations**: Room invitations with status tracking

**User Profile Fields:**
- `phone_number`: User's phone number
- `designation`: User's job title/designation
- `bio`: User's biography/description
- `avatar_url`: Profile picture URL

**Room Customization:**
- `background_image_url`: Custom background image for room
- `background_layout`: Preset layout theme (default, office, meeting, cozy, modern, custom)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/search` - Search users by username/email
- `PUT /api/auth/status` - Update user status
- `POST /api/auth/logout` - Logout user

### Rooms
- `GET /api/rooms` - Get all rooms
- `GET /api/rooms/:id` - Get room details
- `POST /api/rooms` - Create new room
- `POST /api/rooms/:id/join` - Join room
- `POST /api/rooms/:id/leave` - Leave room
- `PUT /api/rooms/:id/position` - Update position in room
- `DELETE /api/rooms/:id` - Delete room

### Calls
- `POST /api/calls` - Create/start a call
- `GET /api/calls/:id` - Get call details
- `POST /api/calls/:id/join` - Join a call
- `POST /api/calls/:id/leave` - Leave/end a call
- `PUT /api/calls/:id/participant` - Update participant settings
- `POST /api/calls/:id/record` - Start recording a call
- `POST /api/calls/:id/record/stop` - Stop recording a call
- `GET /api/calls/history/all` - Get all call history
- `GET /api/calls/history/me` - Get user's call history
- `GET /api/calls/:id/review` - Get detailed call review

### Chat
- `GET /api/chat/rooms/:roomId/messages` - Get room messages
- `POST /api/chat/rooms/:roomId/messages` - Send a message
- `DELETE /api/chat/messages/:id` - Delete a message

### Files
- `POST /api/files/rooms/:roomId/files` - Upload file to room
- `GET /api/files/rooms/:roomId/files` - Get room files
- `GET /api/files/:id/download` - Download a file
- `DELETE /api/files/:id` - Delete a file

### Invitations
- `POST /api/invitations/rooms/:roomId/invite` - Send invitation to room
- `GET /api/invitations/invitations` - Get user's invitations
- `POST /api/invitations/:id/accept` - Accept an invitation
- `POST /api/invitations/:id/decline` - Decline an invitation
- `GET /api/invitations/rooms/:roomId/invitations` - Get room's sent invitations
- `POST /api/invitations/token/:token/accept` - Accept invitation by token (for email links)

### Profile
- `GET /api/profile/profile` - Get user profile
- `PUT /api/profile/profile` - Update user profile (name, phone, designation, bio)
- `POST /api/profile/avatar` - Upload profile picture

### Rooms (Additional)
- `PUT /api/rooms/:id/background` - Update room background layout/image
- `POST /api/rooms/:id/background/upload` - Upload custom room background image

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## Socket.IO Events

### Client to Server
- `join-room` - Join a virtual room
- `leave-room` - Leave current room
- `update-position` - Update user position in room
- `update-status` - Update user status
- `call-initiate` - Start a call
- `call-answer` - Answer an incoming call
- `call-end` - End a call
- `webrtc-offer` - WebRTC offer
- `webrtc-answer` - WebRTC answer
- `webrtc-ice-candidate` - WebRTC ICE candidate

### Server to Client
- `room-participants` - List of participants in room
- `user-joined` - User joined the room
- `user-left` - User left the room
- `user-position-updated` - User position changed
- `user-status-updated` - User status changed
- `incoming-call` - Incoming call notification
- `call-initiated` - Call started
- `call-answered` - Call answered
- `call-ended` - Call ended
- `new-invitation` - New room invitation received
- `invitation-sent` - Invitation sent notification
- `webrtc-offer` - WebRTC offer received
- `webrtc-answer` - WebRTC answer received
- `webrtc-ice-candidate` - WebRTC ICE candidate received

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Select/Create Room**: Choose an existing room or create a new one
3. **Enter Virtual Office**: Your avatar appears in the room canvas
4. **Move Around**: Click and drag your avatar to move in the virtual space
5. **Start Calls**: Use the control panel to start audio/video calls with room participants
6. **View History**: Access call history from the header to review past calls

## Development

### Project Structure
```
Virtual-Office/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # React contexts
│   │   └── App.js
│   └── package.json
├── server/                # Node.js backend
│   ├── config/            # Database and config
│   ├── middleware/        # Auth middleware
│   ├── routes/            # API routes
│   ├── socket/            # Socket.io handlers
│   └── index.js
├── package.json
└── README.md
```

### Scripts
- `npm run dev` - Start both server and client concurrently
- `npm run server` - Start only the server
- `npm run client` - Start only the client
- `npm run build` - Build client for production

## Security Considerations

- JWT tokens expire after 7 days
- Passwords are hashed using bcrypt
- WebRTC uses STUN servers for NAT traversal
- CORS is configured for specific origins
- SQL injection protection via parameterized queries

## New Features Implemented

✅ **Screen Sharing**: Share your screen during video calls
✅ **Real-time Chat**: Text messaging within rooms
✅ **File Sharing**: Upload and download files in rooms
✅ **Call Recording**: Start/stop recording with metadata storage
✅ **TURN Server Support**: Better WebRTC connectivity configuration

## Future Enhancements

- Multiple rooms support (enhanced)
- Advanced collaboration tools (whiteboard, annotations)
- Mobile app support
- Push notifications
- Advanced file preview
- Video recording playback

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check `.env` file has correct database credentials
- Ensure database user has proper permissions

### WebRTC Connection Issues
- Check browser permissions for camera/microphone
- Verify firewall settings allow WebRTC traffic
- Consider adding TURN servers for better connectivity

### Socket Connection Issues
- Verify server is running on correct port
- Check CORS settings in server configuration
- Ensure JWT token is valid

## License

MIT License

## Support

For issues and questions, please open an issue in the repository.

