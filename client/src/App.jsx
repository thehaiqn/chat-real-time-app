import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';
import { useCallStore } from './store/useCallStore';
import CallOverlay from './components/CallOverlay';

function App() {
  const { authUser, connectSocket, socket } = useAuthStore();
  const { subscribeToMessages, unsubscribeFromMessages } = useChatStore();

  useEffect(() => {
    if (authUser) {
      connectSocket();
    }
  }, [authUser, connectSocket]);

  useEffect(() => {
    if (socket) {
      subscribeToMessages();
      useCallStore.getState().initializeCallListeners();
    }
    return () => {
      unsubscribeFromMessages();
    };
  }, [socket, subscribeToMessages, unsubscribeFromMessages]);

  return (
    <div className="bg-body-light text-black h-screen flex flex-col overflow-hidden">
      <Navbar />
      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/register" element={!authUser ? <RegisterPage /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!authUser ? <ForgotPasswordPage /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={!authUser ? <ResetPasswordPage /> : <Navigate to="/" />} />
      </Routes>
      <Toaster />
      {authUser && <CallOverlay />}
    </div>
  );
}

export default App;
