import { io } from 'socket.io-client';

// Определяем URL сокета в зависимости от окружения
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001');

class SocketService {
    constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.eventQueue = []; // Очередь событий для регистрации после подключения
    this.userId = localStorage.getItem('chat_userId');
    this.username = localStorage.getItem('chat_username');
    this.initPromise = null;
    this.isConnecting = false;
    this.connectionAttempts = 0;
    this.maxAttempts = 5;
    this.isInitialized = false;
    this.eventLog = [];
  }

  logEvent(direction, event, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      direction, // '→' отправка, '←' получение
      event,
      data: data ? (typeof data === 'object' ? '📦' + JSON.stringify(data).substring(0, 100) : data) : null
    };
    
    this.eventLog.push(logEntry);
    console.log(`[Socket ${direction}] ${event}:`, data);
    
    // Ограничим лог
    if (this.eventLog.length > 100) {
      this.eventLog.shift();
    }
  }

      connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        console.log('🔄 Уже подключаемся...');
        if (this.initPromise) {
          this.initPromise.then(resolve).catch(reject);
        }
        return;
      }

      if (this.socket?.connected && this.isInitialized) {
        console.log('✅ Уже подключено и инициализировано');
        resolve({ userId: this.userId, username: this.username });
        return;
      }

      // Always refresh credentials from localStorage before connecting
      this.userId = localStorage.getItem('chat_userId');
      this.username = localStorage.getItem('chat_username');
      console.log('📝 Using credentials:', { userId: this.userId, username: this.username });

      this.isConnecting = true;
      this.connectionAttempts++;
      
      console.log(`🔌 Попытка подключения #${this.connectionAttempts} к ${SOCKET_URL}`);

      this.initPromise = new Promise((res, rej) => {
        this.initResolve = res;
        this.initReject = rej;
      });

      const timeout = setTimeout(() => {
        if (this.isConnecting) {
          console.error('❌ Таймаут подключения');
          this.isConnecting = false;
          reject(new Error('Timeout connecting to server'));
        }
      }, 15000);

      try {
        if (this.socket) {
          console.log('🧹 Очистка старого сокета');
          this.socket.removeAllListeners();
          this.socket.disconnect();
        }

                const options = {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: false,
          path: '/socket.io'
        };

        if (process.env.NODE_ENV === 'production') {
          options.secure = window.location.protocol === 'https:';
        }

        console.log('📡 Опции сокета:', options);
        this.socket = io(SOCKET_URL, options);

        // Регистрируем базовые обработчики
        this.socket.on('connect', () => {
          console.log('✅ WebSocket подключен, ID:', this.socket.id);
          clearTimeout(timeout);
          this.connectionAttempts = 0;
          
          // Регистрируем все отложенные события
          this.registerQueuedEvents();
          
          // Отправляем инициализацию с JWT токеном
          const token = localStorage.getItem('token');
          const initData = {
            username: this.username,
            userId: this.userId,
            token: token || undefined
          };
          console.log('📤 Отправка init:', initData);
          this.socket.emit('init', initData);
        });

        this.socket.on('initialized', (data) => {
          console.log('📦 Получен initialized:', data);
          
          this.userId = data.userId;
          this.username = data.username;
          localStorage.setItem('chat_userId', data.userId);
          localStorage.setItem('chat_username', data.username);
          
          this.isConnecting = false;
          this.isInitialized = true;
          
          if (this.initResolve) {
            this.initResolve(data);
            this.initPromise = null;
            this.initResolve = null;
            this.initReject = null;
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Ошибка подключения:', error.message);
          clearTimeout(timeout);
          
          if (this.connectionAttempts >= this.maxAttempts) {
            this.isConnecting = false;
            if (this.initReject) {
              this.initReject(new Error('Failed to connect to server'));
            }
          }
        });

        this.socket.on('disconnect', (reason) => {
          console.log('🔌 WebSocket отключен:', reason);
          this.isConnecting = false;
          this.isInitialized = false;
        });

      } catch (error) {
        clearTimeout(timeout);
        console.error('❌ Ошибка создания сокета:', error);
        this.isConnecting = false;
        reject(error);
      }

      this.initPromise.then(resolve).catch(reject);
    });
  }

  cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

    on(event, callback) {
    console.log(`📋 Попытка регистрации обработчика для ${event}`);
    
    // Если обработчик уже существует, удаляем его перед добавлением нового
    if (this.listeners.has(event)) {
      const oldCallback = this.listeners.get(event);
      if (this.socket) {
        console.log(`🔄 Удаление предыдущего обработчика для ${event} перед заменой`);
        this.socket.off(event, oldCallback);
      }
      // Удаляем из очереди, если там есть
      this.eventQueue = this.eventQueue.filter(item => item.event !== event);
    }
    
    // Сохраняем новый обработчик
    this.listeners.set(event, callback);
    
    // Если сокет уже создан, регистрируем сразу
    if (this.socket) {
      console.log(`✅ Регистрация обработчика ${event} на существующем сокете`);
      this.socket.on(event, callback);
    } else {
      // Если сокета нет, добавляем в очередь
      console.log(`⏳ Сокет еще не создан, событие ${event} добавлено в очередь`);
      this.eventQueue.push({ event, callback });
    }
  }

  registerQueuedEvents() {
    if (!this.socket) return;
    
    console.log(`📋 Регистрация ${this.eventQueue.length} событий из очереди`);
    this.eventQueue.forEach(({ event, callback }) => {
      console.log(`✅ Регистрация отложенного обработчика ${event}`);
      this.socket.on(event, callback);
    });
    this.eventQueue = [];
  }

    off(event) {
    if (this.socket && this.listeners.has(event)) {
      this.socket.off(event, this.listeners.get(event));
      this.listeners.delete(event);
      console.log(`🗑️ Удален обработчик для ${event}`);
    }
    // Также удаляем из очереди, если событие там есть
    const initialLength = this.eventQueue.length;
    this.eventQueue = this.eventQueue.filter(item => item.event !== event);
    if (this.eventQueue.length < initialLength) {
      console.log(`🗑️ Удалено из очереди событие ${event}`);
    }
  }

  emit(event, data) {
    if (!this.socket?.connected) {
      console.warn(`⚠️ Сокет не подключен, событие ${event} не отправлено`);
      return false;
    }
    
    console.log(`📤 Отправка ${event}:`, data);
    this.logEvent('→', event, data);
    this.socket.emit(event, data);
    return true;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  getUserId() {
    return this.userId;
  }

  getUsername() {
    return this.username;
  }

  setUsername(username) {
    if (this.username !== username) {
      this.username = username;
      localStorage.setItem('chat_username', username);
      if (this.isConnected()) {
        this.emit('changeUsername', username);
      }
    }
  }

  getEventLog() {
    return this.eventLog;
  }
}

const socketService = new SocketService();
export default socketService;