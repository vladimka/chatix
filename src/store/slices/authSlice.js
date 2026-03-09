import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// Async thunks
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      // Сохраняем токен и имя пользователя в localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('chat_username', response.data.user.username);
      localStorage.setItem('chat_userId', response.data.user.userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      // Сохраняем токен и имя пользователя в localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('chat_username', response.data.user.username);
      localStorage.setItem('chat_userId', response.data.user.userId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verify',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No token');
      
      const response = await api.get('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Сохраняем имя пользователя и userId для сокета
      localStorage.setItem('chat_username', response.data.user.username);
      localStorage.setItem('chat_userId', response.data.user.userId);
      return response.data;
    } catch (error) {
      localStorage.removeItem('token');
      localStorage.removeItem('chat_username');
      localStorage.removeItem('chat_userId');
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { getState, rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.put('/api/auth/profile', profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Обновляем localStorage если изменилось имя пользователя
      if (response.data.user.username) {
        localStorage.setItem('chat_username', response.data.user.username);
      }
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('token') || null,
    isLoading: false,
    error: null,
    isAuthenticated: !!localStorage.getItem('token')
  },
  reducers: {
    logout: (state) => {
      localStorage.removeItem('token');
      localStorage.removeItem('chat_username');
      localStorage.removeItem('chat_userId');
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      // Verify token
      .addCase(verifyToken.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(verifyToken.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      // Update profile
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload.user;
      });
  }
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
