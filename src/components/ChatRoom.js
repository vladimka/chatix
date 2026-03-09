import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import socketService from '../services/socket';
import RoomList from './RoomList';
import RoomInfo from './RoomInfo';
import UserList from './UserList';
import ConnectionStatus from './ConnectionStatus';
import CreateRoomModal from './CreateRoomModal';
import InviteModal from './InviteModal';
import { 
  addMessage, 
  setHistory,
  setUsers,
  setRooms,
  setCurrentRoom,
  setUserTyping,
  setConnectionStatus,
  clearHistory,
  setError,
  clearError,
  selectMessages,
  selectUsers,
  selectRooms,
  selectCurrentRoom,
  selectConnectionStatus,
  selectError
} from '../store/slices/chatSlice';
import './ChatRoom.css';

const ChatRoom = ({ user, onLogout }) => {
  const dispatch = useDispatch();
  const messages = useSelector(selectMessages);
  const users = useSelector(selectUsers);
  const rooms = useSelector(selectRooms);
  const currentRoom = useSelector(selectCurrentRoom);
  const connectionStatus = useSelector(selectConnectionStatus);
  const error = useSelector(selectError);
  
  // Используем данные из socketService (гарантированно доступны после инициализации)
  const [userId, setUserId] = useState(() => socketService.getUserId());
  const [username, setUsername] = useState(() => socketService.getUsername());
  
  console.log('🔍 Текущий userId в состоянии:', userId);
  console.log('🔍 Текущий username в состоянии:', username);
  console.log('🔍 socketService.getUserId():', socketService.getUserId());
  console.log('🔍 socketService.getUsername():', socketService.getUsername());
  
    // Обновляем userId и username при изменении сокета или user prop
  useEffect(() => {
    const updateUserData = () => {
      const socketUserId = socketService.getUserId();
      const socketUsername = socketService.getUsername();
      if (socketUserId) {
        console.log('🔄 Обновляем userId из socketService:', socketUserId);
        setUserId(socketUserId);
      } else if (user?.userId) {
        console.log('🔄 Обновляем userId из user prop:', user.userId);
        setUserId(user.userId);
      }
      if (socketUsername) {
        console.log('🔄 Обновляем username из socketService:', socketUsername);
        setUsername(socketUsername);
      } else if (user?.username) {
        console.log('🔄 Обновляем username из user prop:', user.username);
        setUsername(user.username);
      }
    };
    
    updateUserData();
    
    // Периодически проверяем, т.к. сокет может инициализироваться позже
    const interval = setInterval(updateUserData, 500);
    return () => clearInterval(interval);
  }, [user]);
  
    // Также слушаем событие initialized для мгновенного обновления
  useEffect(() => {
    const handleInitialized = (data) => {
      console.log('📦 Сокет инициализирован:', data);
      if (data.userId) {
        setUserId(data.userId);
      }
      if (data.username) {
        setUsername(data.username);
      }
    };
    
    socketService.on('initialized', handleInitialized);
    return () => socketService.off('initialized');
  }, []);
  
    // Синхронизация с user prop
  useEffect(() => {
    if (user?.username) {
      localStorage.setItem('chat_username', user.username);
    }
    if (user?.userId) {
      localStorage.setItem('chat_userId', user.userId);
    }
    // Обновляем socket service если есть данные
    if (user?.username) {
      socketService.username = user.username;
    }
    if (user?.userId) {
      socketService.userId = user.userId;
    }
  }, [user]);
  
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showRoomList, setShowRoomList] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isChangingRoom, setIsChangingRoom] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isIOS, setIsIOS] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Определяем iOS устройство
  useEffect(() => {
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    if (iOS) {
      document.body.classList.add('ios-device');
    }
  }, []);

  // Отслеживание размера экрана
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      if (mobile) {
        setShowRoomList(false);
        setShowUserList(false);
      } else {
        setShowRoomList(true);
        setShowUserList(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Функции для открытия/закрытия панелей на мобильных
  const toggleRoomList = useCallback(() => {
    if (isMobile) {
      setShowRoomList(prev => !prev);
      setShowUserList(false);
    } else {
      setShowRoomList(prev => !prev);
    }
  }, [isMobile]);

  const toggleUserList = useCallback(() => {
    if (isMobile) {
      setShowUserList(prev => !prev);
      setShowRoomList(false);
    } else {
      setShowUserList(prev => !prev);
    }
  }, [isMobile]);

  // Закрытие панелей при клике вне (для мобильных)
  useEffect(() => {
    if (!isMobile) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest('.rooms-panel') && !e.target.closest('.menu-btn')) {
        setShowRoomList(false);
      }
      if (!e.target.closest('.users-panel') && !e.target.closest('.users-toggle')) {
        setShowUserList(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isMobile]);

  // Подключение к WebSocket и инициализация
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 3;

    // Регистрируем все обработчики ДО подключения
    console.log('📋 Регистрация всех обработчиков событий...');

    const handleConnect = () => {
      console.log('🔌 Событие connect');
      dispatch(setConnectionStatus('connected'));
    };

    const handleDisconnect = () => {
      console.log('🔌 Событие disconnect');
      dispatch(setConnectionStatus('disconnected'));
    };

    const handleHistory = (history) => {
      console.log('📜 Получена история:', history?.length || 0);
      if (Array.isArray(history)) {
        dispatch(setHistory(history));
        setTimeout(scrollToBottom, 100);
      }
    };

            const handleNewMessage = (message) => {
      console.log('💬 Новое сообщение:', message);
      console.log('💬 userId текущего пользователя:', userId);
      console.log('💬 authorId сообщения:', message.authorId);
      console.log('💬 Совпадают?', String(message.authorId) === String(userId));
      dispatch(addMessage(message));
      scrollToBottom();
    };

    const handleUsersList = (users) => {
      console.log('👥 Получен список пользователей:', users?.length || 0);
      dispatch(setUsers(users || []));
    };

    const handleRoomsList = (rooms) => {
      console.log('🏠 ПОЛУЧЕН СПИСОК КОМНАТ:', rooms);
      console.log('🏠 Количество:', rooms?.length || 0);
      
      if (Array.isArray(rooms)) {
        dispatch(setRooms([...rooms]));
      }
    };

    const handleRoomJoined = (room) => {
      console.log('🚪 Присоединились к комнате:', room?.name);
      dispatch(setCurrentRoom(room));
      setIsChangingRoom(false);
    };

    const handleLeftRoom = () => {
      console.log('🚪 Покинули комнату');
      dispatch(setCurrentRoom(null));
    };

    const handleRoomCreated = (room) => {
      console.log('✅ Комната создана:', room?.name);
      setShowCreateRoom(false);
      if (room?._id) {
        setTimeout(() => socketService.emit('joinRoom', room._id), 100);
      }
    };

    const handleRoomUpdated = (room) => {
      if (currentRoom?._id === room._id) {
        dispatch(setCurrentRoom(room));
      }
    };

    const handleRoomDeleted = ({ roomId }) => {
      if (currentRoom?._id === roomId) {
        dispatch(setCurrentRoom(null));
      }
    };

    const handleUserTyping = ({ userId, isTyping }) => {
      dispatch(setUserTyping({ userId, isTyping }));
    };

    const handleRoomInvitation = (invitation) => {
      if (window.confirm(`Приглашение в комнату "${invitation.roomName}" от ${invitation.from}. Принять?`)) {
        socketService.emit('acceptInvitation', invitation.roomId);
      }
    };

    const handleInviteLinkCreated = (data) => {
      navigator.clipboard.writeText(data.link);
      alert(`Ссылка скопирована: ${data.link}`);
    };

    const handleSearchResults = (results) => {
      setSearchResults(results);
    };

    const handleError = (errorMessage) => {
      console.error('❌ Ошибка от сервера:', errorMessage);
      alert(errorMessage);
      setIsChangingRoom(false);
    };

    // Регистрируем все обработчики
    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);
    socketService.on('history', handleHistory);
    socketService.on('newMessage', handleNewMessage);
    socketService.on('usersList', handleUsersList);
    socketService.on('roomsList', handleRoomsList);
    socketService.on('roomJoined', handleRoomJoined);
    socketService.on('leftRoom', handleLeftRoom);
    socketService.on('roomCreated', handleRoomCreated);
    socketService.on('roomUpdated', handleRoomUpdated);
    socketService.on('roomDeleted', handleRoomDeleted);
    socketService.on('userTyping', handleUserTyping);
    socketService.on('roomInvitation', handleRoomInvitation);
    socketService.on('inviteLinkCreated', handleInviteLinkCreated);
    socketService.on('searchResults', handleSearchResults);
    socketService.on('error', handleError);

    // Подключаемся
    const initializeChat = async () => {
      try {
        dispatch(setConnectionStatus('connecting'));
        console.log('🔄 Начинаем инициализацию чата...');

        const initData = await socketService.connect();
        
        if (!mounted) return;
                console.log('✅ Чат инициализирован:', initData);
        
        setIsInitialized(true);
        dispatch(setConnectionStatus('connected'));

      } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        
        if (!mounted) return;

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Повторная попытка ${retryCount}/${maxRetries} через 2 секунды...`);
          setTimeout(initializeChat, 2000);
        } else {
          dispatch(setConnectionStatus('disconnected'));
          dispatch(setError('Не удалось подключиться к серверу'));
        }
      }
    };

    initializeChat();

    return () => {
      console.log('🧹 Очистка эффекта ChatRoom');
      mounted = false;
      
      socketService.off('connect');
      socketService.off('disconnect');
      socketService.off('history');
      socketService.off('newMessage');
      socketService.off('usersList');
      socketService.off('roomsList');
      socketService.off('roomJoined');
      socketService.off('leftRoom');
      socketService.off('roomCreated');
      socketService.off('roomUpdated');
      socketService.off('roomDeleted');
      socketService.off('userTyping');
      socketService.off('roomInvitation');
      socketService.off('inviteLinkCreated');
      socketService.off('searchResults');
      socketService.off('error');
    };
    }, [dispatch]);

  // Прокрутка вниз
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Обработка появления клавиатуры на iOS
  useEffect(() => {
    if (!isIOS) return;

    const handleResize = () => {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isIOS]);

  // Отправка сообщения
  const handleSendMessage = useCallback(() => {
    if (!inputMessage.trim() || connectionStatus !== 'connected' || !currentRoom) return;

    socketService.emit('sendMessage', {
      text: inputMessage.trim()
    });

    setInputMessage('');
    messageInputRef.current?.focus();
  }, [inputMessage, connectionStatus, currentRoom]);

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

    if (!isTyping && e.target.value && currentRoom) {
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
  }, [isTyping, currentRoom]);

  // Обработка фокуса на iOS
  const handleInputFocus = useCallback(() => {
    if (isIOS) {
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth',
            block: 'end'
          });
        }
      }, 300);
    }
  }, [isIOS]);

  // Выбор комнаты
  const handleRoomSelect = useCallback((room) => {
    setIsChangingRoom(true);
    console.log('Выбрана комната:', room.name, room._id);
    
    const joinRoom = () => {
      if (room.isPrivate) {
        const password = prompt('Введите пароль для доступа к комнате:');
        if (password !== null) {
          socketService.emit('joinRoom', room._id, password);
        } else {
          setIsChangingRoom(false);
        }
      } else {
        socketService.emit('joinRoom', room._id);
      }
      if (isMobile) setShowRoomList(false);
    };

    if (currentRoom) {
      console.log('Покидаем текущую комнату перед входом в новую');
      socketService.emit('leaveRoom');
      setTimeout(joinRoom, 200);
    } else {
      joinRoom();
    }
  }, [currentRoom, isMobile]);

    // Поиск комнат
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (query.trim()) {
      socketService.emit('searchRooms', query);
    } else {
      setSearchResults([]);
    }
  }, []);

  // Выход из комнаты
  const handleLeaveRoom = useCallback(() => {
    if (currentRoom && window.confirm('Покинуть комнату?')) {
      socketService.emit('leaveRoom');
      if (isMobile) setShowUserList(false);
    }
  }, [currentRoom, isMobile]);

  // Форматирование времени
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Форматирование даты
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  // Показываем загрузку пока не инициализировано
  if (!isInitialized) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <div>Подключение к чату...</div>
      </div>
    );
  }

  return (
    <div className={`chat-room-fullscreen ${isIOS ? 'ios-device' : ''}`}>
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
            className={`menu-btn ${showRoomList ? 'active' : ''}`}
            onClick={toggleRoomList}
            title="Список комнат"
          >
            ☰
          </button>
          <h1 className="chat-title">
            💬 Чат
            {isMobile && rooms.length > 0 && (
              <span className="room-count-badge">{rooms.length}</span>
            )}
          </h1>
        </div>

        <div className="header-center">
          <ConnectionStatus />
          {currentRoom && !isMobile && (
            <div className="current-room-info" onClick={() => setShowRoomInfo(true)}>
              <span className="room-name">#{currentRoom.name}</span>
              <span className="room-topic">{currentRoom.topic || 'Нет темы'}</span>
              <button className="room-info-btn" title="Информация о комнате">ℹ️</button>
            </div>
          )}
        </div>

        <div className="header-right">
          <div className="user-info">
            <span className="username-display">{username}</span>
          </div>
          <button 
            className={`btn-icon users-toggle ${showUserList ? 'active' : ''}`}
            onClick={toggleUserList}
            title="Участники онлайн"
          >
            👥 {!isMobile && users.length}
          </button>
          {onLogout && (
            <button 
              className="btn-icon logout-btn"
              onClick={onLogout}
              title="Выйти"
            >
              🚪
            </button>
          )}
        </div>
      </div>

      {/* Мобильная информация о текущей комнате */}
      {isMobile && currentRoom && (
        <div className="mobile-room-info" onClick={() => setShowRoomInfo(true)}>
          <span className="room-name">#{currentRoom.name}</span>
          <span className="room-topic">{currentRoom.topic || 'Нет темы'}</span>
          <button className="room-info-btn">ℹ️</button>
        </div>
      )}

      {/* Основной контент */}
      <div className="chat-main" ref={messagesContainerRef}>
        {/* Левая панель - комнаты */}
        <div className={`rooms-panel ${showRoomList ? 'open' : ''}`}>
          <div className="rooms-panel-header">
            <h3>Комнаты {rooms.length > 0 && `(${rooms.length})`}</h3>
            <button 
              className="create-room-btn"
              onClick={() => setShowCreateRoom(true)}
              title="Создать комнату"
            >
              ➕
            </button>
          </div>
          
          {/* Поиск комнат */}
          <div className="rooms-search">
            <input
              type="text"
              placeholder="Поиск комнат..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Результаты поиска или список комнат */}
          {searchResults.length > 0 ? (
            <div className="search-results">
              <h4>Результаты поиска:</h4>
              {searchResults.map(room => (
                <div 
                  key={room._id} 
                  className="room-item search-result"
                  onClick={() => {
                    handleRoomSelect(room);
                    if (isMobile) setShowRoomList(false);
                  }}
                >
                  <span className="room-name">#{room.name}</span>
                  <span className="room-meta">
                    {room.members?.length || 0} 👥
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <RoomList 
              rooms={rooms}
              currentRoom={currentRoom}
              onRoomSelect={(room) => {
                handleRoomSelect(room);
                if (isMobile) setShowRoomList(false);
              }}
            />
          )}
        </div>

        {/* Центральная область - сообщения */}
        <div className="messages-container">
          {currentRoom ? (
            <>
              <div className="messages-wrapper">
                {messages && messages.length > 0 ? (
                  messages.map((msg, index) => {
                    const msgDate = msg.timestamp ? formatDate(msg.timestamp) : 'Неизвестно';
                    const prevMsgDate = index > 0 && messages[index-1]?.timestamp 
                      ? formatDate(messages[index-1].timestamp) 
                      : null;
                    
                    const showDate = index === 0 || msgDate !== prevMsgDate;
                    const msgKey = msg._id || msg.id || `msg-${index}-${Date.now()}`;
                    
                    return (
                      <React.Fragment key={msgKey}>
                        {showDate && (
                          <div className="date-separator">
                            {msgDate}
                          </div>
                        )}
                        
                                                {msg.system ? (
                          <div className="system-message">
                            {msg.text || 'Системное сообщение'}
                          </div>
                        ) : (
                          <div className={`message ${userId && String(msg.authorId) === String(userId) ? 'own' : ''}`}>
                            <div className="message-header">
                              <span className="author">{msg.author || 'Неизвестно'}</span>
                              <span className="time">
                                {msg.timestamp ? formatTime(msg.timestamp) : '--:--'}
                              </span>
                            </div>
                            <div className="message-content">
                              {msg.text || 'Пустое сообщение'}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <div className="no-messages">
                    <p>Нет сообщений в этой комнате</p>
                    <p className="no-messages-hint">Напишите что-нибудь...</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Панель ввода - всегда видна внизу */}
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
                  onFocus={handleInputFocus}
                  disabled={connectionStatus !== 'connected' || !currentRoom}
                />
                <button 
                  className="send-btn-full" 
                  onClick={handleSendMessage}
                  disabled={connectionStatus !== 'connected' || !currentRoom}
                >
                  {isMobile ? '➤' : 'Отправить'}
                </button>
                {!isMobile && (
                  <>
                    <button 
                      className="invite-btn"
                      onClick={() => setShowInviteModal(true)}
                      title="Пригласить в комнату"
                      disabled={!currentRoom}
                    >
                      🔗
                    </button>
                    <button 
                      className="leave-btn"
                      onClick={handleLeaveRoom}
                      title="Покинуть комнату"
                      disabled={!currentRoom}
                    >
                      🚪
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="no-room-selected">
              <h2>Выберите комнату</h2>
              <p>для начала общения</p>
              <button 
                className="create-room-big-btn"
                onClick={() => setShowCreateRoom(true)}
              >
                ➕ Создать
              </button>
            </div>
          )}
        </div>

        {/* Правая панель - пользователи */}
        <div className={`users-panel ${showUserList ? 'open' : ''}`}>
          <div className="users-panel-header">
            <h3>Участники {users.length > 0 && `(${users.length})`}</h3>
            <button 
              className="close-panel"
              onClick={() => setShowUserList(false)}
            >
              ✕
            </button>
          </div>
          <UserList users={users} />
        </div>
      </div>

      {/* Модальные окна */}
      {showCreateRoom && (
        <CreateRoomModal
          onClose={() => setShowCreateRoom(false)}
          onCreate={(roomData) => {
            socketService.emit('createRoom', roomData);
          }}
        />
      )}

      {showInviteModal && currentRoom && (
        <InviteModal
          room={currentRoom}
          onClose={() => setShowInviteModal(false)}
          onInvite={(username) => {
            socketService.emit('inviteToRoom', {
              roomId: currentRoom._id,
              username
            });
            setShowInviteModal(false);
          }}
          onCreateLink={(options) => {
            socketService.emit('createInviteLink', currentRoom._id, options);
          }}
        />
      )}

      {showRoomInfo && currentRoom && (
        <RoomInfo
          room={currentRoom}
          onClose={() => setShowRoomInfo(false)}
          onUpdate={(updates) => {
            socketService.emit('updateRoom', {
              roomId: currentRoom._id,
              updates
            });
            setShowRoomInfo(false);
          }}
          onDelete={() => {
            if (window.confirm('Удалить комнату? Это действие нельзя отменить.')) {
              socketService.emit('deleteRoom', currentRoom._id);
              setShowRoomInfo(false);
            }
          }}
        />
      )}

      {/* Индикатор загрузки при смене комнаты */}
      {isChangingRoom && (
        <div className="room-change-overlay">
          <div className="loading-spinner-small"></div>
          <div>Переключение комнаты...</div>
        </div>
      )}
    </div>
  );
};

export default ChatRoom;