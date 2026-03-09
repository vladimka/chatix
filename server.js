const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== КОНФИГУРАЦИЯ JWT ====================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

// ==================== МОДЕЛИ MONGOOSE ====================

// Схема для пользователя (добавляем email и password)
const userSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => uuidv4()
  },
  username: { 
    type: String, 
    required: true, 
    trim: true, 
    unique: true,
    minlength: 2,
    maxlength: 30
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  },
  socketId: { type: String, sparse: true },
  lastSeen: { type: Date, default: Date.now, index: true },
  joinTime: { type: Date, default: Date.now },
  ip: String,
  userAgent: String,
  messageCount: { type: Number, default: 0 },
  favoriteRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  createdRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  settings: {
    notifications: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: true },
    theme: { type: String, default: 'dark' }
  }
});

// Индексы для быстрого поиска
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

// Схема для комнаты
const roomSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  description: { 
    type: String, 
    maxlength: 200,
    default: ''
  },
  topic: { 
    type: String, 
    maxlength: 100,
    default: ''
  },
  createdBy: {
    userId: { type: String, required: true },
    username: String,
    socketId: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  isPrivate: { 
    type: Boolean, 
    default: false 
  },
  password: { 
    type: String,
    select: false
  },
  members: [{
    userId: { type: String, required: true },
    username: String,
    role: { 
      type: String, 
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: { type: Date, default: Date.now }
  }],
  bannedUsers: [{
    userId: String,
    username: String,
    reason: String,
    bannedAt: { type: Date, default: Date.now },
    bannedBy: String
  }],
  settings: {
    allowFiles: { type: Boolean, default: true },
    allowLinks: { type: Boolean, default: true },
    slowMode: { type: Number, default: 0 },
    membersCanInvite: { type: Boolean, default: true },
    onlyMembersCanWrite: { type: Boolean, default: false }
  },
  messageCount: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now, index: true }
});

// Схема для сообщения
const messageSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  author: { type: String, required: true },
  authorId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  system: { type: Boolean, default: false },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', index: true },
  attachments: [{
    type: { type: String, enum: ['image', 'file', 'link'] },
    url: String,
    name: String,
    size: Number
  }]
});

// Схема для приглашений
const invitationSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  token: { type: String, required: true, unique: true },
  createdBy: {
    userId: String,
    username: String
  },
  createdAt: { type: Date, default: Date.now, expires: '7d' },
  maxUses: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  expiresAt: Date,
  usedBy: [{
    userId: String,
    username: String,
    usedAt: { type: Date, default: Date.now }
  }]
});

// Создаем модели
const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Message = mongoose.model('Message', messageSchema);
const Invitation = mongoose.model('Invitation', invitationSchema);

// ==================== MIDDLEWARE ====================

// Middleware для проверки JWT токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'Требуется токен авторизации' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Токен истек' });
      }
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
}

// Middleware для опциональной аутентификации (не требует токен, но проверяет если есть)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
}

// ==================== ПОДКЛЮЧЕНИЕ К MONGODB ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB подключена');

    // Миграция: добавляем userId для существующих записей без него
    const users = await User.find({ userId: { $exists: false } });
    for (const user of users) {
      user.userId = uuidv4();
      await user.save();
      console.log(`🔄 Обновлен пользователь: добавлен userId ${user.userId}`);
    }

    // Синхронизируем индексы (создаст только отсутствующие)
    try {
      await User.syncIndexes();
      await Room.syncIndexes();
      await Message.syncIndexes();
      await Invitation.syncIndexes();
      console.log('✅ Индексы синхронизированы');
    } catch (error) {
      console.log('⚠️ Ошибка синхронизации индексов:', error.message);
    }
    
    // Создаем дефолтные комнаты если их нет
    const defaultRooms = [
      { name: 'general', description: 'Общий чат для всех', topic: 'Добро пожаловать!' },
      { name: 'random', description: 'Флуд и разговоры на любые темы', topic: 'Оффтоп' },
      { name: 'tech', description: 'Обсуждение технологий и программирования', topic: 'IT' },
      { name: 'music', description: 'Для любителей музыки', topic: 'Музыка' }
    ];
    
    for (const roomData of defaultRooms) {
      const exists = await Room.findOne({ name: roomData.name });
      if (!exists) {
        await Room.create({
          ...roomData,
          createdBy: { userId: 'system', username: 'system' }
        });
        console.log(`✅ Создана комната: ${roomData.name}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
}

// ==================== HTTP ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ====================

// Регистрация нового пользователя
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Валидация
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    
    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({ error: 'Имя пользователя должно быть от 2 до 30 символов' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не менее 6 символов' });
    }
    
    // Проверяем существование пользователя
    const existingUser = await User.findOne({ 
      $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
      if (existingUser.username === username) {
        return res.status(409).json({ error: 'Пользователь с таким именем уже существует' });
      }
      if (existingUser.email === email) {
        return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
      }
    }
    
    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Создаем пользователя
    const user = new User({
      username: username.trim(),
      email: email?.trim().toLowerCase() || undefined,
      password: hashedPassword,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });
    
    await user.save();
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.userId, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log(`✅ Зарегистрирован новый пользователь: ${username} (${user.userId})`);
    
    res.status(201).json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        joinTime: user.joinTime
      },
      token
    });
    
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Логин пользователя
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Имя пользователя и пароль обязательны' });
    }
    
    // Ищем пользователя с паролем
    const user = await User.findOne({ 
      username: username.trim() 
    }).select('+password');
    
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }
    
    // Обновляем lastSeen и socketId
    user.lastSeen = new Date();
    await user.save();
    
    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.userId, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log(`✅ Пользователь вошел: ${username} (${user.userId})`);
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        joinTime: user.joinTime,
        messageCount: user.messageCount
      },
      token
    });
    
  } catch (error) {
    console.error('❌ Ошибка логина:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Верификация токена (для проверки на клиенте)
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        joinTime: user.joinTime,
        messageCount: user.messageCount,
        lastSeen: user.lastSeen
      }
    });
  } catch (error) {
    console.error('❌ Ошибка верификации:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Обновление профиля
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;
    
    const user = await User.findOne({ userId: req.user.userId })
      .select('+password');
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Если меняем пароль - проверяем текущий
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Требуется текущий пароль' });
      }
      
      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Неверный текущий пароль' });
      }
      
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Новый пароль должен быть не менее 6 символов' });
      }
      
      user.password = await bcrypt.hash(newPassword, 10);
    }
    
    // Обновляем имя пользователя
    if (username && username !== user.username) {
      if (username.length < 2 || username.length > 30) {
        return res.status(400).json({ error: 'Имя пользователя должно быть от 2 до 30 символов' });
      }
      
      const existingUsername = await User.findOne({ username: username.trim() });
      if (existingUsername && existingUsername.userId !== user.userId) {
        return res.status(409).json({ error: 'Имя пользователя уже занято' });
      }
      
      user.username = username.trim();
    }
    
    // Обновляем email
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email: email.trim().toLowerCase() });
      if (existingEmail && existingEmail.userId !== user.userId) {
        return res.status(409).json({ error: 'Email уже используется' });
      }
      user.email = email.trim().toLowerCase();
    }
    
    await user.save();
    
    res.json({
      success: true,
      user: {
        userId: user.userId,
        username: user.username,
        email: user.email,
        joinTime: user.joinTime,
        messageCount: user.messageCount
      }
    });
    
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// ==================== ХРАНЕНИЕ В ПАМЯТИ ====================


const onlineUsers = new Map(); // socketId -> { userId, username, roomId, lastActivity }
const socketConnections = new Map(); // userId -> socketId (для отслеживания дублирующихся подключений)
const roomTyping = new Map(); // roomId -> Set of typing users

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function generateInviteToken() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Проверка доступа к комнате
async function canAccessRoom(room, userId, password = null) {
  if (!room.isPrivate) return true;
  
  if (password && room.password) {
    return await bcrypt.compare(password, room.password);
  }
  
  return room.members.some(m => m.userId === userId);
}

// Отправка системного сообщения
async function sendSystemMessage(roomId, text, author = 'ℹ️', authorId = 'system') {
  try {
    if (!roomId) {
      console.log('⚠️ Попытка отправить системное сообщение без roomId');
      return null;
    }

    const message = new Message({
      author,
      authorId,
      text,
      system: true,
      roomId,
      timestamp: new Date()
    });
    
    await message.save();
    
    await Room.findByIdAndUpdate(roomId, {
      $inc: { messageCount: 1 },
      lastActivity: new Date()
    });
    
        // Проверяем есть ли кто-то в комнате перед отправкой
    const roomSockets = await io.in(roomId.toString()).fetchSockets();
    if (roomSockets.length > 0) {
      io.to(roomId.toString()).emit('newMessage', message.toObject());
    }
    
    return message;
  } catch (error) {
    console.error('Ошибка при отправке системного сообщения:', error);
    return null;
  }
}

// Обновление списка пользователей в комнате
async function broadcastUserList(roomId) {
  try {
    const usersInRoom = Array.from(onlineUsers.entries())
      .filter(([_, user]) => user.roomId?.toString() === roomId.toString())
      .map(([id, user]) => ({
        id,
        userId: user.userId,
        username: user.username,
        joinTime: user.joinTime,
        isTyping: roomTyping.get(roomId)?.has(id) || false
      }));
    
    io.to(roomId.toString()).emit('usersList', usersInRoom);
  } catch (error) {
    console.error('Ошибка при обновлении списка пользователей:', error);
  }
}

// ==================== WEB SOCKET ОБРАБОТЧИКИ ====================

io.on('connection', (socket) => {
  console.log('🔌 Новое подключение:', socket.id);

  // ===== ИНИЦИАЛИЗАЦИЯ =====
    socket.on('init', async (data) => {
    try {
      const { username, userId: existingUserId, token } = data;
      const trimmedUsername = username?.trim();
      
      if (!trimmedUsername) {
        console.log('❌ Init received without username');
        socket.emit('error', 'Имя пользователя обязательно');
        return;
      }
      
      console.log('📝 Init received:', { 
        username: trimmedUsername, 
        userId: existingUserId,
        hasToken: !!token 
      });
      
      let userId = existingUserId;
      let user = null;
      
      // Если есть JWT токен - проверяем его
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId;
          user = await User.findOne({ userId });
          console.log('🔐 Пользователь авторизован по JWT:', userId);
        } catch (err) {
          console.log('⚠️ Неверный JWT токен:', err.message);
          // Продолжаем как анонимный пользователь
        }
      }
      
      // Если нет пользователя (ни по токену, ни по userId) - создаем нового
      if (!user) {
        // Если передан userId - пытаемся найти пользователя
        if (userId) {
          user = await User.findOne({ userId });
          console.log('🔍 Поиск пользователя по userId:', userId, user ? 'найден' : 'не найден');
        }
        
        // Если все равно нет - создаем нового
        if (!user) {
          userId = uuidv4();
          user = new User({
            userId,
            username: trimmedUsername,
            socketId: socket.id,
            ip: socket.handshake.address,
            userAgent: socket.handshake.headers['user-agent']
          });
          await user.save();
          console.log(`👤 Создан новый пользователь: ${trimmedUsername} (${userId})`);
        } else {
          // Пользователь найден по userId, но без токена - обновляем данные
          user.socketId = socket.id;
          user.lastSeen = new Date();
          if (user.username !== trimmedUsername) {
            console.log(`🔄 Смена имени: ${user.username} -> ${trimmedUsername}`);
            user.username = trimmedUsername;
          }
          await user.save();
          console.log(`👤 Пользователь переподключился: ${trimmedUsername} (${userId})`);
        }
      } else {
        // Пользователь найден по JWT токену
        user.socketId = socket.id;
        user.lastSeen = new Date();
        if (user.username !== trimmedUsername) {
          console.log(`🔄 Смена имени: ${user.username} -> ${trimmedUsername}`);
          user.username = trimmedUsername;
          await user.save();
        }
        console.log(`👤 Пользователь авторизован: ${trimmedUsername} (${userId})`);
      }

      // Сохраняем связь userId -> socketId
      socketConnections.set(userId, socket.id);

      // Сохраняем в памяти
      onlineUsers.set(socket.id, {
        userId: user.userId,
        username: user.username,
        roomId: null,
        joinTime: Date.now(),
        lastActivity: Date.now()
      });

      // Отправляем пользователю его ID и токен (если его не было)
      const response = {
        userId: user.userId,
        username: user.username,
        isAuthenticated: !!token
      };
      
      // Если пользователь только что авторизовался через JWT, даем новый токен
      if (token && user) {
        const newToken = jwt.sign(
          { userId: user.userId, username: user.username },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRES_IN }
        );
        response.token = newToken;
      }
      
      socket.emit('initialized', response);

      // Получаем список комнат
      const rooms = await Room.find({ 
        $or: [
          { isPrivate: false },
          { 'members.userId': user.userId }
        ]
      })
        .select('-password')
        .lean();

      console.log(`📋 Отправка roomsList клиенту ${socket.id}: ${rooms.length} комнат`);
      console.log('📋 Список комнат:', rooms.map(r => ({ id: r._id, name: r.name })));

      socket.emit('roomsList', rooms);
      
      console.log(`✅ ${user.username} инициализирован с ID: ${user.userId}`);

    } catch (error) {
      console.error('❌ Ошибка инициализации:', error);
      socket.emit('error', 'Ошибка инициализации');
    }
  });

  // ===== ПРИСОЕДИНЕНИЕ К КОМНАТЕ =====
  socket.on('joinRoom', async (roomId, password = null) => {
    try {
      console.log(`🔍 Попытка присоединения к комнате ${roomId} от ${socket.id}`);
      
      const user = onlineUsers.get(socket.id);
      if (!user) {
        console.error('❌ Пользователь не найден для socket.id:', socket.id);
        socket.emit('error', 'Пользователь не найден');
        return;
      }

      if (!roomId) {
        socket.emit('error', 'ID комнаты не указан');
        return;
      }

      const room = await Room.findById(roomId).select('+password');
      if (!room) {
        console.error('❌ Комната не найдена:', roomId);
        socket.emit('error', 'Комната не найдена');
        return;
      }

      console.log(`📋 Комната найдена: ${room.name}, приватная: ${room.isPrivate}`);

      // Проверяем доступ
      const hasAccess = await canAccessRoom(room, user.userId, password);
      if (!hasAccess) {
        console.error('❌ Нет доступа к комнате:', room.name);
        socket.emit('error', 'Нет доступа к комнате');
        return;
      }

      // Добавляем пользователя в список участников если нужно
      const isMember = room.members.some(m => m.userId === user.userId);
      if (!isMember && !room.isPrivate) {
        room.members.push({
          userId: user.userId,
          username: user.username,
          role: 'member',
          joinedAt: new Date()
        });
        await room.save();
        console.log(`✅ Пользователь ${user.username} добавлен в участники комнаты ${room.name}`);
      }

      // Покидаем предыдущую комнату
      if (user.roomId) {
        const oldRoomId = user.roomId.toString();
        console.log(`👋 Пользователь ${user.username} покидает комнату ${oldRoomId}`);
        
        try {
          await sendSystemMessage(
            oldRoomId,
            `👋 ${user.username} покинул комнату`,
            'ℹ️',
            'system'
          );
        } catch (e) {
          console.log('⚠️ Не удалось отправить сообщение о выходе:', e.message);
        }
        
        socket.leave(oldRoomId);
        
        try {
          await broadcastUserList(oldRoomId);
        } catch (e) {
          console.log('⚠️ Не удалось обновить список пользователей в старой комнате:', e.message);
        }
        
        if (roomTyping.has(oldRoomId)) {
          roomTyping.get(oldRoomId).delete(socket.id);
        }
      }

      // Присоединяемся к новой комнате
      const newRoomId = roomId.toString();
      socket.join(newRoomId);
      console.log(`✅ Пользователь ${user.username} присоединился к комнате ${newRoomId}`);

      user.roomId = roomId;
      user.lastActivity = Date.now();
      
      if (!roomTyping.has(newRoomId)) {
        roomTyping.set(newRoomId, new Set());
      }

      const history = await Message.find({ roomId })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean();

      console.log(`📜 Загружено ${history.length} сообщений истории`);
      socket.emit('history', history.reverse());
      
      const roomData = room.toObject();
      roomData.isCreator = room.createdBy.userId === user.userId;
      socket.emit('roomJoined', roomData);

      try {
        await sendSystemMessage(
          roomId,
          `✨ ${user.username} присоединился к комнате`,
          'ℹ️',
          'system'
        );
      } catch (e) {
        console.log('⚠️ Не удалось отправить сообщение о входе:', e.message);
      }

      await broadcastUserList(roomId);
      await Room.findByIdAndUpdate(roomId, { lastActivity: new Date() });

      console.log(`🚪 ${user.username} успешно вошел в комнату ${room.name}`);

    } catch (error) {
      console.error('❌ Ошибка при входе в комнату:', error);
      console.error(error.stack);
      socket.emit('error', 'Не удалось войти в комнату: ' + error.message);
    }
  });

  // ===== СОЗДАНИЕ КОМНАТЫ =====
  socket.on('createRoom', async (roomData) => {
    try {
      console.log('📥 Получен запрос на создание комнаты:', roomData);
      
      const user = onlineUsers.get(socket.id);
      if (!user) {
        console.error('❌ Пользователь не найден для socket.id:', socket.id);
        socket.emit('error', 'Пользователь не найден');
        return;
      }

      if (!roomData) {
        socket.emit('error', 'Отсутствуют данные для создания комнаты');
        return;
      }

      const name = roomData.name?.trim();
      const description = roomData.description?.trim() || '';
      const topic = roomData.topic?.trim() || '';
      const isPrivate = roomData.isPrivate || false;
      const password = roomData.password;
      const settings = roomData.settings || {};

      if (!name) {
        socket.emit('error', 'Название комнаты обязательно');
        return;
      }

      if (name.length < 2 || name.length > 50) {
        socket.emit('error', 'Название комнаты должно быть от 2 до 50 символов');
        return;
      }

      const existingRoom = await Room.findOne({ name });
      if (existingRoom) {
        socket.emit('error', 'Комната с таким названием уже существует');
        return;
      }

      let hashedPassword = null;
      if (isPrivate && password) {
        if (password.length < 4) {
          socket.emit('error', 'Пароль должен быть не менее 4 символов');
          return;
        }
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const newRoom = new Room({
        name,
        description,
        topic,
        isPrivate,
        password: hashedPassword,
        createdBy: {
          userId: user.userId,
          username: user.username,
          socketId: socket.id
        },
        members: [{
          userId: user.userId,
          username: user.username,
          role: 'admin',
          joinedAt: new Date()
        }],
        settings: {
          allowFiles: settings.allowFiles !== undefined ? settings.allowFiles : true,
          allowLinks: settings.allowLinks !== undefined ? settings.allowLinks : true,
          slowMode: settings.slowMode || 0,
          membersCanInvite: settings.membersCanInvite !== undefined ? settings.membersCanInvite : true,
          onlyMembersCanWrite: settings.onlyMembersCanWrite !== undefined ? settings.onlyMembersCanWrite : false
        },
        createdAt: new Date(),
        lastActivity: new Date()
      });

      await newRoom.save();
      console.log(`✅ Комната сохранена в БД: ${newRoom.name} (${newRoom._id})`);

      await User.findOneAndUpdate(
        { userId: user.userId },
        { $push: { createdRooms: newRoom._id } }
      );

            const rooms = await Room.find({ 
        $or: [
          { isPrivate: false },
          { 'members.userId': user.userId }
        ]
      })
        .select('-password')
        .lean();

      console.log(`📋 Получено ${rooms.length} комнат для обновления`);
      io.emit('roomsList', rooms); // Broadcast to ALL clients

      const roomDataResponse = {
        ...newRoom.toObject(),
        isCreator: true
      };
      delete roomDataResponse.password;
      
      socket.emit('roomCreated', roomDataResponse);
      console.log(`✅ Отправлено подтверждение создания комнаты пользователю ${user.username}`);

      try {
        const generalRoom = await Room.findOne({ name: 'general' });
        if (generalRoom) {
          const systemMessage = new Message({
            text: `✨ Создана новая комната: #${name} ${isPrivate ? '🔒' : ''}`,
            author: 'ℹ️',
            authorId: 'system',
            system: true,
            roomId: generalRoom._id,
            timestamp: new Date()
          });
          await systemMessage.save();
          io.to(generalRoom._id.toString()).emit('newMessage', systemMessage.toObject());
        }
      } catch (notifyError) {
        console.log('⚠️ Не удалось отправить уведомление о новой комнате:', notifyError.message);
      }

    } catch (error) {
      console.error('❌ Ошибка при создании комнаты:', error);
      console.error(error.stack);
      socket.emit('error', 'Не удалось создать комнату: ' + error.message);
    }
  });

  // ===== ОТПРАВКА СООБЩЕНИЯ =====
  socket.on('sendMessage', async (data) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', 'Вы не в комнате');
        return;
      }

      const room = await Room.findById(user.roomId);
      if (!room) return;

      if (room.settings.onlyMembersCanWrite) {
        const isMember = room.members.some(m => m.userId === user.userId);
        if (!isMember) {
          socket.emit('error', 'Только участники могут писать в этой комнате');
          return;
        }
      }

      if (room.settings.slowMode > 0) {
        const lastMessage = await Message.findOne({
          roomId: room._id,
          authorId: user.userId
        }).sort({ timestamp: -1 });

        if (lastMessage) {
          const timeDiff = (Date.now() - new Date(lastMessage.timestamp).getTime()) / 1000;
          if (timeDiff < room.settings.slowMode) {
            socket.emit('error', `Подождите ${Math.ceil(room.settings.slowMode - timeDiff)} секунд`);
            return;
          }
        }
      }

            const message = new Message({
        text: data.text.trim(),
        author: user.username,
        authorId: user.userId,
        roomId: room._id,
        attachments: data.attachments || []
      });

      console.log(`📨 Отправлено сообщение: author=${user.username}, authorId=${user.userId}`);
      await message.save();

      await Room.findByIdAndUpdate(room._id, {
        $inc: { messageCount: 1 },
        lastActivity: new Date()
      });

      await User.findOneAndUpdate(
        { userId: user.userId },
        { $inc: { messageCount: 1 } }
      );

      io.to(room._id.toString()).emit('newMessage', message.toObject());

      const typingSet = roomTyping.get(room._id.toString());
      if (typingSet?.has(socket.id)) {
        typingSet.delete(socket.id);
        io.to(room._id.toString()).emit('userTyping', {
          userId: socket.id,
          isTyping: false
        });
      }

    } catch (error) {
      console.error('❌ Ошибка при отправке сообщения:', error);
    }
  });

  // ===== ПЕЧАТАЕТ... =====
  socket.on('typing', (isTyping) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !user.roomId) return;

    const roomId = user.roomId.toString();
    const typingSet = roomTyping.get(roomId);

    if (isTyping) {
      typingSet?.add(socket.id);
    } else {
      typingSet?.delete(socket.id);
    }

    socket.to(roomId).emit('userTyping', {
      userId: socket.id,
      username: user.username,
      isTyping
    });
  });

    // ===== СМЕНА НИКА =====
  socket.on('changeUsername', async (newUsername) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const trimmedName = newUsername?.trim();
      
      if (!trimmedName) {
        socket.emit('error', 'Имя пользователя не может быть пустым');
        return;
      }
      
      const oldUsername = user.username;

      if (trimmedName === oldUsername) return;

      user.username = trimmedName;
      user.lastActivity = Date.now();

      await User.findOneAndUpdate(
        { userId: user.userId },
        { username: trimmedName, lastSeen: new Date() }
      );

      if (user.roomId) {
        await sendSystemMessage(
          user.roomId,
          `Пользователь ${oldUsername} теперь известен как ${trimmedName}`,
          'ℹ️',
          'system'
        );
        await broadcastUserList(user.roomId);
      }

      console.log(`🔄 Смена ника: ${oldUsername} -> ${trimmedName}`);

    } catch (error) {
      console.error('Ошибка при смене ника:', error);
    }
  });

  // ===== ПРИГЛАШЕНИЕ В КОМНАТУ =====
  socket.on('inviteToRoom', async ({ roomId, username }) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      const isMember = room.members.some(m => m.userId === user.userId);
      if (room.isPrivate && !isMember) {
        socket.emit('error', 'Нет прав на приглашение');
        return;
      }

      const targetUserEntry = Array.from(onlineUsers.entries())
        .find(([_, u]) => u.username.toLowerCase() === username.toLowerCase());

      if (!targetUserEntry) {
        socket.emit('error', 'Пользователь не найден или не в сети');
        return;
      }

      const [targetSocketId, targetUser] = targetUserEntry;

      io.to(targetSocketId).emit('roomInvitation', {
        roomId: room._id,
        roomName: room.name,
        from: user.username,
        fromUserId: user.userId,
        isPrivate: room.isPrivate
      });

      socket.emit('invitationSent', `Приглашение отправлено ${username}`);

    } catch (error) {
      console.error('Ошибка при отправке приглашения:', error);
    }
  });

  // ===== ПРИНЯТИЕ ПРИГЛАШЕНИЯ =====
  socket.on('acceptInvitation', async (roomId) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      const isAlreadyMember = room.members.some(m => m.userId === user.userId);
      if (!isAlreadyMember) {
        room.members.push({
          userId: user.userId,
          username: user.username,
          role: 'member',
          joinedAt: new Date()
        });
        await room.save();
      }

      socket.emit('joinRoom', roomId);

    } catch (error) {
      console.error('Ошибка при принятии приглашения:', error);
    }
  });

  // ===== СОЗДАНИЕ ПРИГЛАСИТЕЛЬНОЙ ССЫЛКИ =====
  socket.on('createInviteLink', async (roomId, options = {}) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const room = await Room.findById(roomId);
      if (!room || !room.isPrivate) {
        socket.emit('error', 'Только для приватных комнат');
        return;
      }

      const isAdmin = room.members.some(m => 
        m.userId === user.userId && m.role === 'admin'
      );

      if (!isAdmin) {
        socket.emit('error', 'Только администратор может создавать ссылки');
        return;
      }

      const token = generateInviteToken();
      const invitation = new Invitation({
        roomId,
        token,
        createdBy: {
          userId: user.userId,
          username: user.username
        },
        maxUses: options.maxUses || 1,
        expiresAt: options.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });

      await invitation.save();

      socket.emit('inviteLinkCreated', {
        token,
        link: `${process.env.CLIENT_URL || 'http://localhost:3000'}/join/${token}`,
        expiresAt: invitation.expiresAt,
        maxUses: invitation.maxUses
      });

    } catch (error) {
      console.error('Ошибка при создании ссылки:', error);
    }
  });

  // ===== ПОИСК КОМНАТ =====
  socket.on('searchRooms', async (query) => {
    try {
      const rooms = await Room.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { topic: { $regex: query, $options: 'i' } }
        ],
        isPrivate: false
      })
        .select('name description topic members messageCount lastActivity')
        .limit(20)
        .lean();

      socket.emit('searchResults', rooms);

    } catch (error) {
      console.error('Ошибка при поиске:', error);
    }
  });

  // ===== УПРАВЛЕНИЕ КОМНАТОЙ =====
  socket.on('updateRoom', async ({ roomId, updates }) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      const isCreator = room.createdBy.userId === user.userId;
      const isAdmin = room.members.some(m => 
        m.userId === user.userId && m.role === 'admin'
      );

      if (!isCreator && !isAdmin) {
        socket.emit('error', 'Нет прав на изменение комнаты');
        return;
      }

      Object.assign(room, updates);
      await room.save();

      const roomData = room.toObject();
      roomData.isCreator = isCreator;
      io.to(roomId.toString()).emit('roomUpdated', roomData);

      const rooms = await Room.find({ 
        $or: [
          { isPrivate: false },
          { 'members.userId': user.userId }
        ]
      })
        .select('-password')
        .lean();

      io.emit('roomsList', rooms);

    } catch (error) {
      console.error('Ошибка при обновлении комнаты:', error);
    }
  });

  // ===== УДАЛЕНИЕ КОМНАТЫ =====
  socket.on('deleteRoom', async (roomId) => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user) return;

      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit('error', 'Комната не найдена');
        return;
      }

      if (room.createdBy.userId !== user.userId) {
        socket.emit('error', 'Только создатель может удалить комнату');
        return;
      }

      await Message.deleteMany({ roomId });

      await User.findOneAndUpdate(
        { userId: user.userId },
        { $pull: { createdRooms: roomId } }
      );

      await Room.findByIdAndDelete(roomId);

      io.to(roomId.toString()).emit('roomDeleted', {
        roomId,
        message: 'Комната была удалена'
      });

      const rooms = await Room.find({ 
        $or: [
          { isPrivate: false },
          { 'members.userId': user.userId }
        ]
      })
        .select('-password')
        .lean();

      io.emit('roomsList', rooms);

      console.log(`🗑️ Комната ${room.name} удалена пользователем ${user.username}`);

    } catch (error) {
      console.error('Ошибка при удалении комнаты:', error);
    }
  });

  // ===== ПОКИНУТЬ КОМНАТУ =====
  socket.on('leaveRoom', async () => {
    try {
      const user = onlineUsers.get(socket.id);
      if (!user || !user.roomId) {
        socket.emit('error', 'Вы не в комнате');
        return;
      }

      const roomId = user.roomId.toString();
      console.log(`👋 Пользователь ${user.username} покидает комнату ${roomId}`);

      try {
        await sendSystemMessage(
          roomId,
          `👋 ${user.username} покинул комнату`,
          'ℹ️',
          'system'
        );
      } catch (e) {
        console.log('⚠️ Не удалось отправить сообщение о выходе:', e.message);
      }

      socket.leave(roomId);
      
      if (roomTyping.has(roomId)) {
        roomTyping.get(roomId).delete(socket.id);
      }

      await broadcastUserList(roomId);

      user.roomId = null;
      
      socket.emit('leftRoom');
      console.log(`✅ Пользователь ${user.username} покинул комнату`);

    } catch (error) {
      console.error('❌ Ошибка при выходе из комнаты:', error);
      socket.emit('error', 'Не удалось покинуть комнату');
    }
  });

  // ===== ОТКЛЮЧЕНИЕ =====
  socket.on('disconnect', async () => {
    try {
      const user = onlineUsers.get(socket.id);
      if (user) {
        console.log(`👋 Пользователь отключается: ${user.username} (${socket.id})`);
        
        const currentConnection = socketConnections.get(user.userId);
        if (currentConnection === socket.id) {
          socketConnections.delete(user.userId);
        }

        if (user.roomId) {
          await sendSystemMessage(
            user.roomId,
            `👋 ${user.username} покинул чат`,
            'ℹ️',
            'system'
          );
          
          roomTyping.get(user.roomId.toString())?.delete(socket.id);
          await broadcastUserList(user.roomId);
        }

        await User.findOneAndUpdate(
          { userId: user.userId },
          { lastSeen: new Date(), socketId: null }
        );

        onlineUsers.delete(socket.id);
      }
      
      console.log(`👋 Сокет отключился: ${socket.id}`);

    } catch (error) {
      console.error('❌ Ошибка при отключении:', error);
    }
  });
});

// ==================== HTTP ЭНДПОИНТЫ ====================

app.get('/api/rooms/:roomId', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .select('-password -bannedUsers')
      .lean();
    
    if (!room) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/rooms/:roomId/stats', optionalAuth, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = {
      totalMessages: room.messageCount,
      membersCount: room.members.length,
      lastActivity: room.lastActivity,
      messagesLastHour: await Message.countDocuments({
        roomId: room._id,
        timestamp: { $gte: lastHour }
      }),
      messagesLastDay: await Message.countDocuments({
        roomId: room._id,
        timestamp: { $gte: lastDay }
      }),
      topUsers: await Message.aggregate([
        { $match: { roomId: room._id } },
        { $group: { _id: '$author', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ])
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/join/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { userId } = req.body;

    const invitation = await Invitation.findOne({ token });
    if (!invitation) {
      return res.status(404).json({ error: 'Приглашение не найдено' });
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Срок действия истек' });
    }

    if (invitation.usedCount >= invitation.maxUses) {
      return res.status(410).json({ error: 'Приглашение уже использовано' });
    }

    const room = await Room.findById(invitation.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Комната не найдена' });
    }

    invitation.usedCount++;
    if (userId) {
      invitation.usedBy.push({ userId, usedAt: new Date() });
    }
    await invitation.save();

    res.json({
      success: true,
      roomId: room._id,
      roomName: room.name,
      isPrivate: room.isPrivate
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      totalMessages: await Message.countDocuments(),
      totalUsers: await User.countDocuments(),
      totalRooms: await Room.countDocuments(),
      onlineUsers: onlineUsers.size,
      activeRooms: new Set(Array.from(onlineUsers.values())
        .map(u => u.roomId?.toString())
        .filter(Boolean)).size,
      messagesToday: await Message.countDocuments({
        timestamp: { $gte: new Date().setHours(0, 0, 0, 0) }
      })
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ЗАПУСК СЕРВЕРА ====================

async function startServer() {
  await connectToMongoDB();

  const localIp = getLocalIp();
  const PORT = process.env.PORT || 3001;

  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 ЧАТ СЕРВЕР ЗАПУЩЕН');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`💻 Локально: http://localhost:${PORT}`);
    console.log(`📱 В сети: http://${localIp}:${PORT}`);
    console.log(`🗄️  MongoDB: ${MONGODB_URI}`);
    console.log('='.repeat(60) + '\n');
  });
}

process.on('SIGINT', async () => {
  console.log('\n📴 Завершение работы...');
  
  for (const [socketId, user] of onlineUsers) {
    await User.findOneAndUpdate(
      { userId: user.userId },
      { lastSeen: new Date(), socketId: null }
    );
  }
  
  await mongoose.connection.close();
  console.log('📴 Соединение с MongoDB закрыто');
  process.exit(0);
});

startServer();