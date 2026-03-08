const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true
});

// ==================== МОДЕЛИ MONGOOSE ====================

// Схема для пользователя
const userSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    unique: true,
    default: () => uuidv4()
  },
  username: { type: String, required: true, trim: true, default: 'Аноним' },
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

// ==================== ПОДКЛЮЧЕНИЕ К MONGODB ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB подключена');

    // Очищаем все существующие индексы для users
    try {
      await mongoose.connection.db.collection('users').dropIndexes();
      console.log('✅ Индексы users очищены');
    } catch (error) {
      console.log('⚠️ Индексы users не найдены или уже очищены');
    }

    // Обновляем существующие документы
    const users = await User.find({ userId: { $exists: false } });
    for (const user of users) {
      user.userId = uuidv4();
      await user.save();
      console.log(`🔄 Обновлен пользователь: добавлен userId ${user.userId}`);
    }

    // Создаем индексы заново
    await User.createIndexes();
    await Room.createIndexes();
    await Message.createIndexes();
    await Invitation.createIndexes();
    
    console.log('✅ Индексы созданы успешно');
    
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
      io.to(roomId.toString()).emit('message', message.toObject());
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
      const { username, userId: existingUserId } = data;
      const trimmedUsername = username?.trim() || 'Аноним';
      
      console.log('📝 Init received:', { username: trimmedUsername, userId: existingUserId });
      
      let userId = existingUserId;
      let user = null;
      
      if (userId) {
        user = await User.findOne({ userId });
        console.log('🔍 Поиск пользователя:', userId, user ? 'найден' : 'не найден');
      }
      
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
        // Проверяем, есть ли уже активное подключение этого пользователя
        const existingSocketId = socketConnections.get(userId);
        if (existingSocketId && existingSocketId !== socket.id) {
          console.log(`⚠️ Пользователь ${trimmedUsername} уже подключен через ${existingSocketId}`);
          
          // Отключаем старое соединение
          const oldSocket = io.sockets.sockets.get(existingSocketId);
          if (oldSocket) {
            oldSocket.emit('error', 'Новое подключение с вашего аккаунта');
            oldSocket.disconnect(true);
          }
        }

        user.socketId = socket.id;
        user.lastSeen = new Date();
        if (user.username !== trimmedUsername) {
          console.log(`🔄 Смена имени: ${user.username} -> ${trimmedUsername}`);
          user.username = trimmedUsername;
        }
        await user.save();
        console.log(`👤 Пользователь переподключился: ${trimmedUsername} (${userId})`);
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

      // Отправляем пользователю его ID
      socket.emit('initialized', {
        userId: user.userId,
        username: user.username
      });

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
      socket.emit('roomsList', rooms);

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

      const trimmedName = newUsername?.trim() || 'Аноним';
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

app.get('/api/rooms/:roomId', async (req, res) => {
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

app.get('/api/rooms/:roomId/stats', async (req, res) => {
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