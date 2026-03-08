const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const os = require('os');

const app = express();

// Получаем IP адрес в локальной сети
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Пропускаем внутренние и не IPv4 адреса
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const PORT = process.env.PORT || 3001;

// Настройка CORS для доступа с мобильных устройств
app.use(cors({
  origin: '*', // В продакшене замените на конкретные домены
  methods: ['GET', 'POST'],
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Разрешаем все источники для разработки
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["*"]
  },
  // Важные настройки для мобильных подключений
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Хранение активных пользователей
const users = new Map();
const messageHistory = [];

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id, 'IP:', socket.handshake.address);

  // Присоединение к чату
  socket.on('join', (username) => {
    users.set(socket.id, {
      username: username || 'Аноним',
      room: 'general',
      joinTime: Date.now()
    });

    socket.emit('history', messageHistory.slice(-50));
    
    socket.broadcast.emit('userJoined', {
      id: socket.id,
      username: users.get(socket.id).username,
      timestamp: Date.now()
    });

    io.emit('usersList', Array.from(users.entries()).map(([id, user]) => ({
      id,
      username: user.username,
      joinTime: user.joinTime
    })));

    console.log(`${users.get(socket.id).username} присоединился к чату с ${socket.handshake.address}`);
  });

  // Обработка сообщений
  socket.on('message', (data) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now() + socket.id,
      author: user.username,
      text: data.text,
      timestamp: Date.now(),
      userId: socket.id,
      system: false
    };

    messageHistory.push(message);
    if (messageHistory.length > 100) {
      messageHistory.shift();
    }

    io.emit('message', message);
  });

  // Печатает...
  socket.on('typing', (isTyping) => {
    const user = users.get(socket.id);
    if (user) {
      socket.broadcast.emit('userTyping', {
        userId: socket.id,
        username: user.username,
        isTyping
      });
    }
  });

  // В server.js обновите обработчик changeUsername
socket.on('changeUsername', (newUsername) => {
  const oldUser = users.get(socket.id);
  if (oldUser) {
    const oldUsername = oldUser.username;
    
    // Проверяем, действительно ли ник изменился
    if (oldUsername !== newUsername) {
      users.set(socket.id, { ...oldUser, username: newUsername });

      // Отправляем системное сообщение только если ник действительно изменился
      const systemMessage = {
        id: Date.now(),
        author: 'ℹ️',
        text: `Пользователь ${oldUsername} теперь известен как ${newUsername}`,
        timestamp: Date.now(),
        system: true
      };

      messageHistory.push(systemMessage);
      io.emit('message', systemMessage);
      io.emit('usersList', Array.from(users.entries()).map(([id, user]) => ({
        id,
        username: user.username,
        joinTime: user.joinTime
      })));
      
      console.log(`Смена ника: ${oldUsername} -> ${newUsername}`);
    }
  }
});

  // Проверка соединения (ping/pong)
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Отключение
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const systemMessage = {
        id: Date.now(),
        author: 'ℹ️',
        text: `Пользователь ${user.username} покинул чат`,
        timestamp: Date.now(),
        system: true
      };

      messageHistory.push(systemMessage);
      io.emit('message', systemMessage);
      
      users.delete(socket.id);
      io.emit('usersList', Array.from(users.entries()).map(([id, user]) => ({
        id,
        username: user.username,
        joinTime: user.joinTime
      })));
    }
    console.log('Пользователь отключился:', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен:`);
  console.log(`- Локально: http://localhost:${PORT}`);
  console.log(`- В сети: http://${localIp}:${PORT}`);
  console.log(`\nДля подключения с телефона используйте:`);
  console.log(`http://${localIp}:${PORT}`);
  console.log(`\nУбедитесь, что:`);
  console.log(`1. Телефон и компьютер в одной Wi-Fi сети`);
  console.log(`2. Брандмауэр не блокирует порт ${PORT}`);
  console.log(`3. В React приложении указан правильный IP: ${localIp}`);
});