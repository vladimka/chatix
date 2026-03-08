import React from 'react';
import { useSelector } from 'react-redux';
import { selectUsers, selectTypingUsers } from '../store/slices/chatSlice';
import './UserList.css';

const UserList = () => {
  const users = useSelector(selectUsers);
  const typingUsers = useSelector(selectTypingUsers);

  return (
    <div className="user-list-full">
      {users.map(user => (
        <div key={user.id} className="user-item-full">
          <div className="user-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div className="user-info-full">
            <span className="user-name-full">{user.username}</span>
            {typingUsers.includes(user.id) && (
              <span className="typing-indicator-full">печатает...</span>
            )}
          </div>
          <span className="user-status-full online" title="Онлайн">●</span>
        </div>
      ))}
      
      {users.length === 0 && (
        <div className="no-users">Нет активных пользователей</div>
      )}
    </div>
  );
};

export default UserList;