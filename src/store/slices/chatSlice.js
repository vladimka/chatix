import { createSlice, createSelector } from '@reduxjs/toolkit';

const initialState = {
  messages: [],
  users: [],
  rooms: [],
  currentRoom: null,
  connectionStatus: 'disconnected',
  error: null,
  typingUsers: [] // Добавляем поле для печатающих пользователей
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      state.messages.push(action.payload);
      if (state.messages.length > 200) {
        state.messages = state.messages.slice(-200);
      }
    },
    
    setHistory: (state, action) => {
      state.messages = action.payload;
    },
    
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    
    setRooms: (state, action) => {
      console.log('🏠 setRooms reducer called with:', action.payload);
      console.log('🏠 Is array:', Array.isArray(action.payload));
      
      // Важно! Создаем новый массив для иммутабельности
      state.rooms = Array.isArray(action.payload) ? [...action.payload] : [];
      
      console.log('🏠 New state.rooms:', state.rooms.length);
    },
    
    setCurrentRoom: (state, action) => {
      state.currentRoom = action.payload;
    },
    
    // Добавляем редьюсер для печатающих пользователей
    setUserTyping: (state, action) => {
      const { userId, isTyping } = action.payload;
      
      // Обновляем статус в списке пользователей
      const user = state.users.find(u => u.id === userId);
      if (user) {
        user.isTyping = isTyping;
      }
      
      // Обновляем список typingUsers
      if (isTyping) {
        if (!state.typingUsers.includes(userId)) {
          state.typingUsers.push(userId);
        }
      } else {
        state.typingUsers = state.typingUsers.filter(id => id !== userId);
      }
    },
    
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
    },
    
    clearHistory: (state) => {
      state.messages = [];
    },
    
    setError: (state, action) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    }
  }
});

// Экспорт действий
export const { 
  addMessage, 
  setHistory,
  setUsers,
  setRooms,
  setCurrentRoom,
  setUserTyping,
  setConnectionStatus,
  clearHistory,
  setError,
  clearError 
} = chatSlice.actions;

// ===== БАЗОВЫЕ СЕЛЕКТОРЫ =====
// Убедитесь, что селектор возвращает актуальные данные
export const selectMessages = (state) => {
  const messages = state.chat?.messages;
  console.log('📊 selectMessages вызван, сообщений:', messages?.length);
  return messages || [];
};
export const selectUsers = (state) => state.chat.users;
export const selectRooms = (state) => {
  console.log('🏠 selectRooms selector called, rooms:', state.chat?.rooms?.length);
  return state.chat?.rooms || [];
}
export const selectCurrentRoom = (state) => state.chat.currentRoom;
export const selectConnectionStatus = (state) => state.chat.connectionStatus;
export const selectError = (state) => state.chat.error;
export const selectTypingUsers = (state) => state.chat.typingUsers; // <-- ДОБАВЛЯЕМ ЭТОТ ЭКСПОРТ

// ===== МЕМОИЗИРОВАННЫЕ СЕЛЕКТОРЫ =====
export const selectSortedMessages = createSelector(
  [selectMessages],
  (messages) => [...messages].sort((a, b) => 
    new Date(a.timestamp) - new Date(b.timestamp)
  )
);

export const selectUsersCount = createSelector(
  [selectUsers],
  (users) => users.length
);

export const selectRoomsCount = createSelector(
  [selectRooms],
  (rooms) => rooms.length
);

// Селектор для получения пользователей, которые печатают
export const selectTypingUsersList = createSelector(
  [selectUsers, selectTypingUsers],
  (users, typingIds) => users.filter(user => typingIds.includes(user.id))
);

// Селектор для получения текста "X печатает..."
export const selectTypingText = createSelector(
  [selectTypingUsersList, selectUsers],
  (typingUsers, allUsers) => {
    const count = typingUsers.length;
    
    if (count === 0) return '';
    if (count === 1) return `${typingUsers[0].username} печатает...`;
    if (count === 2) return `${typingUsers[0].username} и ${typingUsers[1].username} печатают...`;
    if (count === 3) return `${typingUsers[0].username}, ${typingUsers[1].username} и еще 1 печатают...`;
    return `${typingUsers[0].username}, ${typingUsers[1].username} и еще ${count - 2} печатают...`;
  }
);

// Селектор для получения публичных комнат
export const selectPublicRooms = createSelector(
  [selectRooms],
  (rooms) => rooms.filter(room => !room.isPrivate)
);

// Селектор для получения приватных комнат
export const selectPrivateRooms = createSelector(
  [selectRooms],
  (rooms) => rooms.filter(room => room.isPrivate)
);

// Селектор для поиска комнат
export const selectRoomsBySearch = (searchQuery) => createSelector(
  [selectRooms],
  (rooms) => rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.topic?.toLowerCase().includes(searchQuery.toLowerCase())
  )
);

// Селектор для получения статистики
export const selectChatStats = createSelector(
  [selectMessages, selectUsers, selectRooms, selectConnectionStatus],
  (messages, users, rooms, status) => ({
    totalMessages: messages.length,
    onlineUsers: users.length,
    totalRooms: rooms.length,
    connectionStatus: status,
    lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : null
  })
);

export default chatSlice.reducer;