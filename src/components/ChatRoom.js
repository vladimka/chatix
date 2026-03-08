import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import socketService from '../services/socket';
import UserList from './UserList';
import ConnectionStatus from './ConnectionStatus';
import { 
  addMessage, 
  setHistory,
  setUsers,
  addUser,
  removeUser,
  setUserTyping,
  setConnectionStatus,
  clearHistory,
  selectSortedMessages,
  selectConnectionStatus,
  selectError,
  clearError 
} from '../store/slices/chatSlice';
import './ChatRoom.css';
import { useDebounce } from '../hooks/useDebounce';

const ChatRoom = () => {
  const dispatch = useDispatch();
  const messages = useSelector(selectSortedMessages);
  const connectionStatus = useSelector(selectConnectionStatus);
  const error = useSelector(selectError);
  
  const [username, setUsername] = useState(() => {
    return localStorage.getItem('chat_username') || 'Аноним';
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const usernameTimeoutRef = useRef(null); // Таймер для debounce ника
  const lastUsernameRef = useRef(''); // Храним последний отправленный ник

  // Подключение к WebSocket
  useEffect(() => {
    dispatch(setConnectionStatus('connecting'));
    socketService.connect();

    socketService.on('connect', () => {
      dispatch(setConnectionStatus('connected'));
      // При подключении отправляем текущий ник
      const currentUsername = username.trim() || 'Аноним';
      lastUsernameRef.current = currentUsername;
      socketService.emit('join', currentUsername);
    });

    socketService.on('disconnect', () => {
      dispatch(setConnectionStatus('disconnected'));
    });

    socketService.on('history', (history) => {
      dispatch(setHistory(history));
    });

    socketService.on('message', (message) => {
      dispatch(addMessage(message));
    });

    socketService.on('usersList', (users) => {
      dispatch(setUsers(users));
    });

    socketService.on('userJoined', (user) => {
      dispatch(addUser(user));
      dispatch(addMessage({
        id: Date.now(),
        author: 'ℹ️',
        text: `✨ ${user.username} присоединился к чату`,
        timestamp: Date.now(),
        system: true
      }));
    });

    socketService.on('userTyping', ({ userId, isTyping }) => {
      dispatch(setUserTyping({ userId, isTyping }));
    });

    return () => {
      socketService.disconnect();
    };
  }, [dispatch]);

  // Сохранение username в localStorage
  useEffect(() => {
    localStorage.setItem('chat_username', username);
  }, [username]);

  // Используем кастомный хук для debounce ника
  const debouncedUsername = useDebounce(username, 1000, (newUsername) => {
    const trimmedUsername = newUsername.trim() || 'Аноним';
    if (socketService.isConnected() && trimmedUsername !== lastUsernameRef.current) {
      console.log('Debounced отправка ника:', trimmedUsername);
      socketService.emit('changeUsername', trimmedUsername);
      lastUsernameRef.current = trimmedUsername;
    }
  });

  // Прокрутка
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Отправка сообщения
  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || connectionStatus !== 'connected') return;

    socketService.emit('message', {
      text: inputMessage.trim()
    });

    setInputMessage('');
    messageInputRef.current?.focus();
  }, [inputMessage, connectionStatus]);

  // Обработка Enter
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // Индикатор печатания
  const handleInputChange = useCallback((e) => {
    setInputMessage(e.target.value);

    if (!isTyping && e.target.value) {
      setIsTyping(true);
      socketService.emit('typing', true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        socketService.emit('typing', false);
      }
    }, 1000);
  }, [isTyping]);

  // Случайный ник - отправляем сразу, но с debounce
  const generateRandomName = useCallback(() => {
    const names = ['Путешественник', 'Люмос', 'Тень', 'Странник', 'Искра', 
                   'Код', 'Волна', 'Звёзд', 'Пиксель', 'Феникс', 'Nova'];
    const randomName = names[Math.floor(Math.random() * names.length)] + 
                      Math.floor(Math.random() * 1000);
    setUsername(randomName);
    
    // Очищаем предыдущий таймер и отправляем сразу для случайного ника
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }
    
    // Отправляем сразу, но с небольшой задержкой для надежности
    setTimeout(() => {
      if (socketService.isConnected()) {
        socketService.emit('changeUsername', randomName);
        lastUsernameRef.current = randomName;
      }
    }, 100);
  }, []);

  // Очистка истории
  const handleClearHistory = useCallback(() => {
    if (window.confirm('Очистить историю сообщений?')) {
      dispatch(clearHistory());
    }
  }, [dispatch]);

  // Принудительная отправка ника при потере фокуса с поля ввода
  const handleUsernameBlur = useCallback(() => {
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }
    
    const trimmedUsername = username.trim() || 'Аноним';
    if (socketService.isConnected() && trimmedUsername !== lastUsernameRef.current) {
      socketService.emit('changeUsername', trimmedUsername);
      lastUsernameRef.current = trimmedUsername;
    }
  }, [username]);

  // Форматирование времени
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-room-fullscreen">
      {error && (
        <div className="error-banner">
          <span>⚠️ {error}</span>
          <button onClick={() => dispatch(clearError())}>✕</button>
        </div>
      )}

      {/* Верхняя панель */}
      <div className="chat-header">
        <div className="header-left">
          <button 
            className="menu-btn"
            onClick={() => setShowSidebar(!showSidebar)}
            title="Меню"
          >
            ☰
          </button>
          <h1 className="chat-title">
            💬 Chatix
            <span className="badge">online</span>
          </h1>
        </div>

        <div className="header-center">
          <ConnectionStatus />
        </div>

        <div className="header-right">
          <div className="user-info">
            <input
              type="text"
              className="username-input"
              placeholder="Ваш ник"
              maxLength="24"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={handleUsernameBlur} // Отправляем при потере фокуса
              title="Ник изменится через 1 секунду после окончания ввода"
            />
            <button 
              className="btn-icon"
              onClick={generateRandomName}
              title="Случайный ник"
            >
              🎲
            </button>
          </div>
          <button 
            className="btn-icon users-toggle"
            onClick={() => setShowUserList(!showUserList)}
            title="Участники онлайн"
          >
            👥
          </button>
        </div>
      </div>

      {/* Основной контент */}
      <div className="chat-main">
        {/* Левая боковая панель */}
        {showSidebar && (
          <div className="sidebar">
            <div className="sidebar-section">
              <h3>Комнаты</h3>
              <div className="room-list">
                <div className="room-item active"># Общий чат</div>
                <div className="room-item"># Работа</div>
                <div className="room-item"># Флуд</div>
              </div>
            </div>
            <div className="sidebar-section">
              <h3>Настройки</h3>
              <div className="settings-item">
                <label>
                  <input type="checkbox" /> Звук уведомлений
                </label>
              </div>
              <div className="settings-item">
                <label>
                  <input type="checkbox" defaultChecked /> Автопрокрутка
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Центральная область - сообщения */}
        <div className="messages-container">
          <div className="messages-wrapper">
            {messages.map((msg) => {
              if (msg.system) {
                return (
                  <div key={msg.id} className="system-message">
                    {msg.text}
                  </div>
                );
              }

              const isOwn = msg.author === username;
              return (
                <div key={msg.id} className={`message ${isOwn ? 'own' : ''}`}>
                  <div className="message-header">
                    <span className="author">{msg.author}</span>
                    <span className="time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div className="message-content">{msg.text}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Панель ввода */}
          <div className="input-container">
            <input
              ref={messageInputRef}
              type="text"
              className="message-input-full"
              placeholder={connectionStatus === 'connected' 
                ? "Написать сообщение..." 
                : "Ожидание подключения..."}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={connectionStatus !== 'connected'}
            />
            <button 
              className="send-btn-full" 
              onClick={handleSendMessage}
              disabled={connectionStatus !== 'connected'}
            >
              Отправить
            </button>
            <button 
              className="clear-btn-full" 
              onClick={handleClearHistory}
              title="Очистить историю"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Правая боковая панель - пользователи */}
        {showUserList && (
          <div className="users-panel">
            <div className="users-panel-header">
              <h3>Участники онлайн</h3>
              <button 
                className="close-panel"
                onClick={() => setShowUserList(false)}
              >
                ✕
              </button>
            </div>
            <UserList />
          </div>
        )}
      </div>

      {/* Мобильное меню */}
      <div className="mobile-menu">
        <button 
          className={`mobile-menu-btn ${showSidebar ? 'active' : ''}`}
          onClick={() => setShowSidebar(!showSidebar)}
        >
          ☰ Комнаты
        </button>
        <button 
          className={`mobile-menu-btn ${showUserList ? 'active' : ''}`}
          onClick={() => setShowUserList(!showUserList)}
        >
          👥 Участники
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;