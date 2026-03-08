import React, { useState } from 'react';
import './CreateRoomModal.css';

const CreateRoomModal = ({ onClose, onCreate }) => {
  const [roomData, setRoomData] = useState({
    name: '',
    description: '',
    topic: '',
    isPrivate: false,
    password: '',
    settings: {
      allowFiles: true,
      allowLinks: true,
      slowMode: 0,
      membersCanInvite: true,
      onlyMembersCanWrite: false
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (roomData.name.trim()) {
      onCreate(roomData);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать новую комнату</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Название комнаты *</label>
            <input
              type="text"
              value={roomData.name}
              onChange={(e) => setRoomData({...roomData, name: e.target.value})}
              placeholder="например: general, tech, music"
              maxLength="50"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Описание</label>
            <textarea
              value={roomData.description}
              onChange={(e) => setRoomData({...roomData, description: e.target.value})}
              placeholder="Краткое описание комнаты"
              maxLength="200"
              rows="2"
            />
          </div>

          <div className="form-group">
            <label>Тема</label>
            <input
              type="text"
              value={roomData.topic}
              onChange={(e) => setRoomData({...roomData, topic: e.target.value})}
              placeholder="Тема для обсуждения"
              maxLength="100"
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={roomData.isPrivate}
                onChange={(e) => setRoomData({...roomData, isPrivate: e.target.checked})}
              />
              Приватная комната (только по приглашениям)
            </label>
          </div>

          {roomData.isPrivate && (
            <div className="form-group">
              <label>Пароль для доступа</label>
              <input
                type="password"
                value={roomData.password}
                onChange={(e) => setRoomData({...roomData, password: e.target.value})}
                placeholder="Введите пароль"
              />
            </div>
          )}

          <div className="form-group">
            <label>Настройки комнаты</label>
            <div className="settings-group">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={roomData.settings.allowFiles}
                  onChange={(e) => setRoomData({
                    ...roomData, 
                    settings: {...roomData.settings, allowFiles: e.target.checked}
                  })}
                />
                Разрешить файлы
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={roomData.settings.allowLinks}
                  onChange={(e) => setRoomData({
                    ...roomData, 
                    settings: {...roomData.settings, allowLinks: e.target.checked}
                  })}
                />
                Разрешить ссылки
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={roomData.settings.onlyMembersCanWrite}
                  onChange={(e) => setRoomData({
                    ...roomData, 
                    settings: {...roomData.settings, onlyMembersCanWrite: e.target.checked}
                  })}
                />
                Только участники могут писать
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={roomData.settings.membersCanInvite}
                  onChange={(e) => setRoomData({
                    ...roomData, 
                    settings: {...roomData.settings, membersCanInvite: e.target.checked}
                  })}
                />
                Участники могут приглашать
              </label>

              <div className="slow-mode">
                <label>Медленный режим (секунд):</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={roomData.settings.slowMode}
                  onChange={(e) => setRoomData({
                    ...roomData, 
                    settings: {...roomData.settings, slowMode: parseInt(e.target.value)}
                  })}
                />
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="create-btn">
              Создать комнату
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRoomModal;