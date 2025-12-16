import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import VirtualOffice from './components/VirtualOffice/VirtualOffice';
import CallHistory from './components/CallHistory/CallHistory';
import PrivateRoute from './components/Auth/PrivateRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/office"
            element={
              <PrivateRoute>
                <SocketProvider>
                  <VirtualOffice />
                </SocketProvider>
              </PrivateRoute>
            }
          />
          <Route
            path="/history"
            element={
              <PrivateRoute>
                <CallHistory />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/office" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

