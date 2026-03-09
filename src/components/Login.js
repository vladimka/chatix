import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';
import './Auth.css';

const Login = ({ onSwitchToRegister }) => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    dispatch(clearError());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dispatch(login(formData));
    if (result.error) {
      const errorMsg = typeof result.payload === 'string' 
        ? result.payload 
        : result.payload?.error || result.payload?.message || 'Ошибка входа';
      alert(errorMsg);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Вход в Chatix</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Имя пользователя</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={30}
              disabled={isLoading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="error-message">
              {typeof error === 'string' 
                ? error 
                : error.error || error.message || 'Ошибка входа'}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="auth-button">
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className="auth-switch">
          Нет аккаунта?{' '}
          <button type="button" onClick={onSwitchToRegister} className="link-button">
            Зарегистрироваться
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
