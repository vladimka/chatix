import React, { useEffect, useState } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { store } from './store';
import { verifyToken, logout as authLogout } from './store/slices/authSlice';
import socket from './services/socket';
import Login from './components/Login';
import Register from './components/Register';
import ChatRoom from './components/ChatRoom';
import './App.css';

const AppContent = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, user } = useSelector((state) => state.auth);
  const [showAuth, setShowAuth] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  useEffect(() => {
    // Проверяем наличие токена при загрузке
    const token = localStorage.getItem('token');
    if (token && !isAuthenticated) {
      dispatch(verifyToken());
    }
  }, [dispatch, isAuthenticated]);

  const handleLogout = () => {
    dispatch(authLogout());
    socket.cleanup();
    setShowAuth(true);
  };

  // Если загружается проверка токена
  if (isLoading && !isAuthenticated) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Загрузка...</p>
      </div>
    );
  }

  // Если пользователь не авторизован - показываем форму
  if (!isAuthenticated) {
    if (authMode === 'login') {
      return <Login onSwitchToRegister={() => setAuthMode('register')} />;
    }
    return <Register onSwitchToLogin={() => setAuthMode('login')} />;
  }

  // Если авторизован - показываем чат
  return <ChatRoom user={user} onLogout={handleLogout} />;
};

function App() {
  return (
    <Provider store={store}>
      <div className="App">
        <AppContent />
      </div>
    </Provider>
  );
}

export default App;