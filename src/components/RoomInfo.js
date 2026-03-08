import React, { useState, useEffect } from 'react';
import './RoomInfo.css';

const RoomInfo = ({ room, onClose, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRoom, setEditedRoom] = useState({
    name: room.name,
    description: room.description || '',
    topic: room.topic || '',
    settings: { ...room.settings }
  });
  const [activeTab, setActiveTab] = useState('info'); // info, members, settings
  const [members, setMembers] = useState(room.members || []);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // Загрузка статистики комнаты
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/rooms/${room._id}/stats`);
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [room._id]);

  // Форматирование даты
  const formatDate = (date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Роль пользователя на русском
  const getRoleName = (role) => {
    const roles = {
      admin: 'Администратор',
      moderator: 'Модератор',
      member: 'Участник'
    };
    return roles[role] || role;
  };

  // Обработка сохранения изменений
  const handleSave = () => {
    onUpdate(editedRoom);
    setIsEditing(false);
  };

  // Копирование ID комнаты
  const copyRoomId = () => {
    navigator.clipboard.writeText(room._id);
    alert('ID комнаты скопирован');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="room-info-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {room.isPrivate ? '🔒' : '#'} {room.name}
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Табы */}
        <div className="info-tabs">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            ℹ️ Информация
          </button>
          <button 
            className={`tab-btn ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            👥 Участники ({members.length})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Настройки
          </button>
        </div>

        <div className="tab-content">
          {/* Вкладка с информацией */}
          {activeTab === 'info' && (
            <div className="info-tab">
              {!isEditing ? (
                <>
                  <div className="info-row">
                    <span className="info-label">Название:</span>
                    <span className="info-value">{room.name}</span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Описание:</span>
                    <span className="info-value">
                      {room.description || 'Нет описания'}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Тема:</span>
                    <span className="info-value">
                      {room.topic || 'Нет темы'}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Тип:</span>
                    <span className="info-value">
                      {room.isPrivate ? 'Приватная' : 'Публичная'}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Создана:</span>
                    <span className="info-value">
                      {formatDate(room.createdAt)}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">Создатель:</span>
                    <span className="info-value">
                      {room.createdBy?.username || 'Система'}
                    </span>
                  </div>

                  <div className="info-row">
                    <span className="info-label">ID комнаты:</span>
                    <span className="info-value id-value" onClick={copyRoomId}>
                      {room._id} 📋
                    </span>
                  </div>

                  {/* Статистика */}
                  <div className="stats-section">
                    <h3>Статистика</h3>
                    {loading ? (
                      <div className="loading">Загрузка...</div>
                    ) : stats ? (
                      <div className="stats-grid">
                        <div className="stat-item">
                          <span className="stat-label">Всего сообщений:</span>
                          <span className="stat-value">{stats.totalMessages}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">За последний час:</span>
                          <span className="stat-value">{stats.messagesLastHour}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">За последние 24ч:</span>
                          <span className="stat-value">{stats.messagesLastDay}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Участников:</span>
                          <span className="stat-value">{stats.membersCount}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Последняя активность:</span>
                          <span className="stat-value">
                            {formatDate(stats.lastActivity)}
                          </span>
                        </div>

                        {stats.topUsers && stats.topUsers.length > 0 && (
                          <div className="top-users">
                            <h4>Топ участников:</h4>
                            {stats.topUsers.map((user, index) => (
                              <div key={index} className="top-user">
                                <span>{index + 1}. {user._id}</span>
                                <span>{user.count} сообщ.</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="no-stats">Нет данных</div>
                    )}
                  </div>

                  <button 
                    className="edit-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Редактировать
                  </button>
                </>
              ) : (
                // Режим редактирования
                <div className="edit-form">
                  <div className="form-group">
                    <label>Название</label>
                    <input
                      type="text"
                      value={editedRoom.name}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom, 
                        name: e.target.value
                      })}
                      maxLength="50"
                    />
                  </div>

                  <div className="form-group">
                    <label>Описание</label>
                    <textarea
                      value={editedRoom.description}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom, 
                        description: e.target.value
                      })}
                      maxLength="200"
                      rows="3"
                    />
                  </div>

                  <div className="form-group">
                    <label>Тема</label>
                    <input
                      type="text"
                      value={editedRoom.topic}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom, 
                        topic: e.target.value
                      })}
                      maxLength="100"
                    />
                  </div>

                  <div className="edit-actions">
                    <button 
                      className="cancel-btn"
                      onClick={() => setIsEditing(false)}
                    >
                      Отмена
                    </button>
                    <button 
                      className="save-btn"
                      onClick={handleSave}
                    >
                      Сохранить
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Вкладка с участниками */}
          {activeTab === 'members' && (
            <div className="members-tab">
              <div className="members-list">
                {members.map((member, index) => (
                  <div key={index} className="member-item">
                    <div className="member-avatar">
                      {member.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <span className="member-name">{member.username}</span>
                      <span className="member-role">
                        {getRoleName(member.role)}
                      </span>
                    </div>
                    <div className="member-joined">
                      {formatDate(member.joinedAt)}
                    </div>
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="no-members">
                    Нет участников
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Вкладка с настройками */}
          {activeTab === 'settings' && (
            <div className="settings-tab">
              <div className="settings-form">
                <div className="setting-item">
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={editedRoom.settings.allowFiles}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom,
                        settings: {
                          ...editedRoom.settings,
                          allowFiles: e.target.checked
                        }
                      })}
                    />
                    Разрешить загрузку файлов
                  </label>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={editedRoom.settings.allowLinks}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom,
                        settings: {
                          ...editedRoom.settings,
                          allowLinks: e.target.checked
                        }
                      })}
                    />
                    Разрешить отправку ссылок
                  </label>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={editedRoom.settings.onlyMembersCanWrite}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom,
                        settings: {
                          ...editedRoom.settings,
                          onlyMembersCanWrite: e.target.checked
                        }
                      })}
                    />
                    Только участники могут писать
                  </label>
                </div>

                <div className="setting-item">
                  <label className="setting-label">
                    <input
                      type="checkbox"
                      checked={editedRoom.settings.membersCanInvite}
                      onChange={(e) => setEditedRoom({
                        ...editedRoom,
                        settings: {
                          ...editedRoom.settings,
                          membersCanInvite: e.target.checked
                        }
                      })}
                    />
                    Участники могут приглашать
                  </label>
                </div>

                <div className="setting-item">
                  <label>Медленный режим (секунд между сообщениями)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={editedRoom.settings.slowMode}
                    onChange={(e) => setEditedRoom({
                      ...editedRoom,
                      settings: {
                        ...editedRoom.settings,
                        slowMode: parseInt(e.target.value)
                      }
                    })}
                  />
                </div>

                {isEditing && (
                  <div className="edit-actions">
                    <button 
                      className="cancel-btn"
                      onClick={() => setIsEditing(false)}
                    >
                      Отмена
                    </button>
                    <button 
                      className="save-btn"
                      onClick={handleSave}
                    >
                      Сохранить настройки
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Нижняя панель с кнопками */}
        <div className="modal-footer">
          <button 
            className="danger-btn"
            onClick={onDelete}
          >
            🗑️ Удалить комнату
          </button>
          {!isEditing && activeTab !== 'info' && (
            <button 
              className="edit-btn"
              onClick={() => setIsEditing(true)}
            >
              ✏️ Редактировать
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomInfo;