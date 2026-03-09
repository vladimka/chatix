# Chatix - Real-time Chat Application

[![React](https://img.shields.io/badge/React-19.2.4-61dafb.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47a248.svg)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8.3-010101.svg)](https://socket.io/)

**Chatix** - это полнофункциональное веб-приложение для реального общения с поддержкой приватных комнат, системными уведомлениями и продвинутыми возможностями управления.

## 🌟 Особенности

- 💬 **Реальное время**: Мгновенная доставка сообщений через WebSocket (Socket.io)
- 🔐 **Безопасность**: Приватные комнаты с паролем, защита от спама
- 🏠 **Комнаты**: Создание, управление, поиск чатов
- 👥 **Управление пользователями**: Роли (админ/модератор/участник), бан, пауза (slow-mode)
- 🔗 **Приглашения**: Генерация инвайт-ссылок с настраиваемыми параметрами
- 📊 **Статистика**: Уведомления о создании комнат, активность пользователей
- 🎨 **Современный UI**: React 19 с Redux Toolkit, CSS-модули
- 🚀 **Масштабируемость**: Поддержка кластеров, MVP-архитектура

## 🏗️ Архитектура

```
chatix/
├── server.js           # Express + Socket.io сервер
├── clean-db.js         # Утилита очистки базы данных
├── package.json        # Backend зависимости
├── .env               # Конфигурация окружения
├── public/            # Статические файлы React
├── src/               # Frontend React приложение
│   ├── components/    # UI компоненты
│   │   ├── ChatRoom.css
│   │   ├── ChatRoom.js      # Основной чат-интерфейс
│   │   ├── ConnectionStatus.js
│   │   ├── CreateRoomModal.css
│   │   ├── CreateRoomModal.js  # Модалка создания комнаты
│   │   ├── InviteModal.css
│   │   ├── InviteModal.js   # Модалка приглашений
│   │   ├── RoomInfo.css
│   │   ├── RoomInfo.js      # Информация о комнате
│   │   ├── RoomList.css
│   │   └── RoomList.js      # Список комнат
│   ├── hooks/         # Кастомные React хуки
│   │   └── useDebounce.js  # Дэбосинг инпута
│   ├── services/      # API и WebSocket клиенты
│   │   └── socket.js       # Socket.io клиент
│   ├── store/         # Redux store + slices
│   │   ├── index.js
│   │   └── slices/
│   │       └── chatSlice.js # Логика чата
│   ├── App.js         # Главный компонент
│   ├── App.css        # Стили приложения
│   ├── index.js       # Точка входа
│   └── ...
├── public/            # CRA статика
│   ├── favicon.ico
│   ├── index.html
│   ├── logo192.png
│   ├── logo512.png
│   ├── manifest.json
│   └── robots.txt
└── README.md          # Эта документация
```

## 🚀 Быстрый старт

### Требования

- **Node.js** 18+
- **MongoDB** 6.0+ (локально или Atlas)
- **npm** или **yarn**

### 1. Установка зависимостей

```bash
# Клонируйте проект
git clone <your-repo-url>
cd chatix

# Установите зависимости
npm install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/chatapp

# Серверный порт
PORT=3001

# URL клиентского приложения (для CORS)
CLIENT_URL=http://localhost:3000
```

Или используйте MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/chatapp
```

### 3. Запуск MongoDB

**Локально (Windows):**
```powershell
# Если MongoDB установлен как служба
net start MongoDB

# Или вручную
mongod
```

**Docker:**
```bash
docker run -d -p 27017:27017 --name mongo mongo:latest
```

### 4. Запуск приложения

```bash
# Одной командой (рекомендуется)
npm run dev

# Или раздельно:
# В одном терминале - сервер
npm run server

# В другом терминале - клиент
npm start
```

### 5. Откройте браузер

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 📦 Доступные npm скрипты

### Development
```bash
npm run dev              # Запуск клиента и сервера одновременно
npm run server           # Запуск только сервера
```

### Frontend (React)
```bash
npm start              # Dev-режим с hot-reload
npm test               # Запуск тестов
npm run build          # Продокшн сборка
npm run eject          # Извлечение конфигурации CRA
```

### Утилиты
```bash
# Очистка базы данных (ВСЕ ДАННЫЕ БУДУТ УДАЛЕНЫ!)
node clean-db.js                    # интерактивный режим
node clean-db.js --confirm          # без подтверждения
node clean-db.js --dry-run          # только показать, что будет удалено
node clean-db.js --db otherdb       # для другой базы
```

## 🔧 Конфигурация

### Переменные окружения (.env)

| Переменная | Обязательная | По умолчанию | Описание |
|------------|--------------|--------------|----------|
| `MONGODB_URI` | ✅ | `mongodb://localhost:27017/chatapp` | URI подключения к MongoDB |
| `PORT` | ❌ | `3001` | Порт сервера |
| `CLIENT_URL` | ❌ | `http://localhost:3000` | URL фронтенда для CORS |

### Структура MongoDB коллекций

- **users** - пользователи (userId, username, socketId, stats)
- **rooms** - комнаты (название, описание, приватность, настройки)
- **messages** - сообщения (текст, автор, timestamp, attachments)
- **invitations** - приглашения (токен, срок действия, лимиты)

## 🌐 API Endpoints

### HTTP REST API

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/rooms/:roomId` | Получить информацию о комнате |
| GET | `/api/rooms/:roomId/stats` | Статистика комнаты |
| POST | `/api/join/:token` | Присоединиться по инвайт-ссылке |
| GET | `/api/stats` | Общая статистика приложения |

### WebSocket Events

#### Клиент → Сервер

```javascript
// Инициализация
socket.emit('init', { userId, username })

// Присоединение к комнате
socket.emit('joinRoom', roomId, password?)

// Создание комнаты
socket.emit('createRoom', {
  name,
  description,
  topic,
  isPrivate,
  password?,
  settings?
})

// Отправка сообщения
socket.emit('sendMessage', { text, attachments? })

// Статус печати
socket.emit('typing', isTyping)

// Смена ника
socket.emit('changeUsername', newUsername)

// Приглашение пользователя
socket.emit('inviteToRoom', { roomId, username })

// Создание инвайт-ссылки
socket.emit('createInviteLink', roomId, { maxUses?, expiresAt? })

// Поиск комнат
socket.emit('searchRooms', query)

// Управление комнатой
socket.emit('updateRoom', { roomId, updates })
socket.emit('deleteRoom', roomId)
socket.emit('leaveRoom')
```

#### Сервер → Клиент

```javascript
// Инициализация завершена
socket.on('initialized', { userId, username })

// Список комнат
socket.on('roomsList', [rooms])

// История сообщений
socket.on('history', [messages])

// Вход в комнату
socket.on('roomJoined', roomData)

// Создание комнаты
socket.on('roomCreated', roomData)

// Обновление комнаты
socket.on('roomUpdated', roomData)

// Новое сообщение
socket.on('newMessage', message)

// Новый пользователь в комнате
socket.on('usersList', [users])

// Статус печати пользователя
socket.on('userTyping', { userId, username, isTyping })

// Приглашение в комнату
socket.on('roomInvitation', { roomId, roomName, from, isPrivate })

// Комната удалена
socket.on('roomDeleted', { roomId, message })

// Выход из комнаты
socket.on('leftRoom')

// Ошибка
socket.on('error', errorMessage)
```

## 🎨 Фронтенд структура

### Основные компоненты

- **ChatRoom** - основной интерфейс чата (сообщения, ввод, пользователи)
- **RoomList** - sidebar со списком доступных комнат
- **UserList** - панель онлайн-пользователей в комнате
- **RoomInfo** - информация о текущей комнате
- **CreateRoomModal** - модальное окно создания комнаты
- **InviteModal** - модалка приглашений/ссылок
- **ConnectionStatus** - индикатор состояния подключения

### State Management (Redux)

```javascript
// chatSlice.js - основная логика
{
  currentRoom: null,
  rooms: [],
  messages: {},
  users: {},
  user: null,
  connectionStatus: 'connected' | 'disconnected'
}

// Экшены:
- initialize(userId, username)
- joinRoom(roomId, password)
- sendMessage(text)
- typing(isTyping)
- changeUsername(newUsername)
- updateRoom(roomData)
- deleteRoom(roomId)
```

## 🛡️ Безопасность

### Реализованные меры:

1. **Аутентификация через userId** - уникальные UUID4
2. **Приватные комнаты** - пароли хешируются bcrypt (salt rounds 10)
3. **Проверка прав** - роли (admin/moderator/member)
4. **Slow Mode** - ограничение частоты сообщений
5. **Only members can write** - защита от спама в приватных комнатах
6. **Валидация входных данных** - trim, проверка длинны, XSS-фильтрация
7. **Инъекции приглашений** - TTL 7 дней, лимит использований

### Рекомендации для production:

- ✅ Добавить JWT или OAuth
- ✅ Включить HTTPS/WSS
- ✅ Rate limiting на подключения
- ✅ Валидация входных данных на клиенте
- ✅ CORS только для доверенных доменов
- ✅ Не отдавать пароли комнат в API
- ✅ Логирование аномалий

## 🧪 Тестирование

```bash
# Запуск тестов
npm test

# С coverage
npm test -- --coverage
```

**Примеры тестов можно добавить в `src/__tests__/`**

## 🐛 Отладка

### Логи сервера

Сервер выводит детальные логи:
- 🔌 Подключения/отключения
- 📝 Инициализация пользователей
- 🚪 Вход/выход из комнат
- 💬 Отправка сообщений
- 🏠 Создание/удаление комнат
- ⚠️ Ошибки с stack trace

### Отладка клиента

```javascript
// Включить лог сокетов
localStorage.setItem('DEBUG_SOCKET', 'true');
```

## 📊 Производительность

### Оптимизации:

- ✅ Индексы MongoDB на часто-запрашиваемых полях
- ✅ In-memory кэши (onlineUsers, socketConnections, roomTyping)
- ✅ Пагинация истории (лимит 100 сообщений)
- ✅ Сжатие WebSocket фреймов
- ✅ Очистка устаревших данных (TTL на приглашениях)

### Мониторинг:

```bash
# Статистика в реальном времени
curl http://localhost:3001/api/stats
```

## 🔄 Развертывание

### Docker (рекомендуется)

`Dockerfile` (нужно создать):

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

`docker-compose.yml`:

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/chatapp
      - CLIENT_URL=https://yourdomain.com
    depends_on:
      - mongo

volumes:
  mongo_data:
```

### PM2 (production)

```bash
npm install -g pm2
pm2 start server.js --name chatix-server
pm2 save
pm2 startup
```

### Vercel / Netlify (Frontend)

Сборка лежит в `build/`. Разверните как статический сайт.

### Heroku / Railway

```bash
# Heroku
heroku create chatix
heroku addons:create mongolab
git push heroku main

# Railway
railway init
railway add mongodb
railway up
```

## 🧹 Очистка данных

⚠️ **ВНИМАНИЕ**: Утилита `clean-db.js` безвозвратно удаляет ВСЕ данные!

```bash
# Безопасная проверка
node clean-db.js --dry-run

# С подтверждением
node clean-db.js

# Для разных сред
node clean-db.js --uri mongodb://localhost:27017/testdb
```

## 📝 Миграции и обновления

### v0.1.0 → v0.2.0 (текущая)

1. Добавлены приглашения
2. Добавлен slow-mode
3. Улучшена валидация
4. Фикс дублей подключений
5. Статистика по комнатам

### Функции для будущих версий:

- [ ] Поддержка файлов (загрузка на S3)
- [ ] Голосовые сообщения
- [ ] Реакции на сообщения
- [ ] Темы оформления
- [ ] Push-уведомления
- [ ] End-to-end шифрование
- [ ] Модерация (команды /ban, /mute)
- [ ] Медиа-галерея

## 🤝 Вклад в проект

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 Лицензия

Этот проект распространяется под лицензией MIT.

## 🙏 Благодарности

- [Socket.io](https://socket.io/) за отличную WebSocket библиотеку
- [Redux Toolkit](https://redux-toolkit.js.org/) за простой state management
- [MongoDB](https://www.mongodb.com/) за мощную NoSQL базу
- [Create React App](https://create-react-app.dev/) за быстрый старт

## 📞 Поддержка

Если у вас есть вопросы или проблемы:

1. Проверьте [Issues](https://github.com/your-repo/issues)
2. Создайте новый issue с деталями
3. Приложите логи сервера и reproduce steps

---

**Сделано с ❤️ для сообщества**
