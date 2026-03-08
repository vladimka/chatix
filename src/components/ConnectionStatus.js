import React from 'react';
import { useSelector } from 'react-redux';
import { selectConnectionStatus } from '../store/slices/chatSlice';

const ConnectionStatus = () => {
  const status = useSelector(selectConnectionStatus);

  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return { text: 'Подключено', className: 'status-connected', icon: '🟢' };
      case 'connecting':
        return { text: 'Подключение...', className: 'status-connecting', icon: '🟡' };
      default:
        return { text: 'Отключено', className: 'status-disconnected', icon: '🔴' };
    }
  };

  const { text, className, icon } = getStatusInfo();

  return (
    <div className={`connection-status ${className}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
};

export default ConnectionStatus;