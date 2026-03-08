import { createSlice, createSelector } from '@reduxjs/toolkit';

const STORAGE_KEY = 'chat_room_messages';

const initialState = {
  messages: [],
  users: [], // онлайн пользователи
  typingUsers: [], // кто печатает
  connectionStatus: 'disconnected', // 'connected' | 'disconnected' | 'connecting'
  error: null
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Добавление сообщения
    addMessage: (state, action) => {
      state.messages.push(action.payload);
      
      // Ограничиваем до 150 сообщений
      if (state.messages.length > 150) {
        state.messages = state.messages.slice(-150);
      }
      
      // Сохраняем в localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.messages));
      } catch (error) {
        state.error = 'Не удалось сохранить сообщение';
      }
    },
    
    // Установка истории сообщений
    setHistory: (state, action) => {
      state.messages = action.payload;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(action.payload));
    },
    
    // Обновление списка пользователей
    setUsers: (state, action) => {
      state.users = action.payload;
    },
    
    // Добавление пользователя
    addUser: (state, action) => {
      if (!state.users.find(u => u.id === action.payload.id)) {
        state.users.push(action.payload);
      }
    },
    
    // Удаление пользователя
    removeUser: (state, action) => {
      state.users = state.users.filter(u => u.id !== action.payload);
      // Убираем из печатающих
      state.typingUsers = state.typingUsers.filter(id => id !== action.payload);
    },
    
    // Статус печатания
    setUserTyping: (state, action) => {
      const { userId, isTyping } = action.payload;
      if (isTyping) {
        if (!state.typingUsers.includes(userId)) {
          state.typingUsers.push(userId);
        }
      } else {
        state.typingUsers = state.typingUsers.filter(id => id !== userId);
      }
    },
    
    // Статус подключения
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
    },
    
    // Очистка истории
    clearHistory: (state) => {
      const systemMessage = {
        id: Date.now(),
        author: 'ℹ️',
        text: 'История была очищена.',
        timestamp: Date.now(),
        system: true
      };
      
      state.messages = [systemMessage];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([systemMessage]));
    },
    
    // Ошибка
    setError: (state, action) => {
      state.error = action.payload;
    },
    
    clearError: (state) => {
      state.error = null;
    }
  }
});

// Селекторы
export const selectMessages = (state) => state.chat.messages;
export const selectUsers = (state) => state.chat.users;
export const selectTypingUsers = (state) => state.chat.typingUsers;
export const selectConnectionStatus = (state) => state.chat.connectionStatus;
export const selectError = (state) => state.chat.error;

// Мемоизированные селекторы
export const selectSortedMessages = createSelector(
  [selectMessages],
  (messages) => [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
);

export const selectTypingUsersList = createSelector(
  [selectUsers, selectTypingUsers],
  (users, typingIds) => users.filter(user => typingIds.includes(user.id))
);

export const { 
  addMessage, 
  setHistory,
  setUsers,
  addUser,
  removeUser,
  setUserTyping,
  setConnectionStatus,
  clearHistory,
  setError,
  clearError 
} = chatSlice.actions;

export default chatSlice.reducer;