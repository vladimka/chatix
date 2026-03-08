import { io } from 'socket.io-client';

// Определяем URL сервера в зависимости от окружения
const getServerUrl = () => {
  // Если задано в environment variables
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }
  
  // Для локальной разработки - получаем IP адрес компьютера
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Замените X.X.X.X на ваш реальный IP в локальной сети
    // Например: 'http://192.168.1.100:3001'
    return 'http://192.168.1.218:3001'; // <-- ИЗМЕНИТЕ ЭТОТ IP
  }
  
  // Для продакшена
  return window.location.origin;
};

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    const serverUrl = getServerUrl();
    console.log('Подключение к серверу:', serverUrl);
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Добавляем polling как запасной вариант
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
      withCredentials: true,
      // Для мобильных сетей важно добавить эти настройки
      forceNew: true,
      multiplex: false
    });

    this.socket.on('connect', () => {
      console.log('WebSocket подключен');
      this.reconnectAttempts = 0;
      this.emit('join', localStorage.getItem('chat_username') || 'Аноним');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Ошибка подключения WebSocket:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        console.log('Превышено количество попыток переподключения');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket отключен:', reason);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      this.listeners.set(event, callback);
    }
  }

  off(event) {
    if (this.socket && this.listeners.has(event)) {
      this.socket.off(event, this.listeners.get(event));
      this.listeners.delete(event);
    }
  }

  isConnected() {
    return this.socket?.connected || false;
  }
}

export default new SocketService();