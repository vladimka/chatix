import { configureStore } from '@reduxjs/toolkit';
import chatReducer from './slices/chatSlice';
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    auth: authReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['chat/addMessage', 'auth/register', 'auth/login', 'auth/verify', 'auth/updateProfile']
      }
    })
});