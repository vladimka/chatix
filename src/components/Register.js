import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '../store/slices/authSlice';
import './Auth.css';

const Register = ({ onSwitchToLogin }) => {
  const dispatch = useDispatch();
  const { isLoading, error } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    
    if (formData.password !== formData.confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }

    const { confirmPassword, ...registerData } = formData;
    const result = await dispatch(register(registerData));
    
    if (result.error) {
      const errorMsg = typeof result.payload === 'string' 
        ? result.payload 
        : result.payload?.error || result.payload?.message || 'Ошибка регистрации';
      alert(errorMsg);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Регистрация в Chatix</h2>
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
            <label htmlFor="email">Email (опционально)</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              maxLength={100}
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Подтвердите пароль</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
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
                : error.error || error.message || 'Ошибка регистрации'}
            </div>
          )}

          <button type="submit" disabled={isLoading} className="auth-button">
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-switch">
          Уже есть аккаунт?{' '}
          <button type="button" onClick={onSwitchToLogin} className="link-button">
            Войти
          </button>
        </div>
      </div>
    </div>
  );
};

export default Register;
