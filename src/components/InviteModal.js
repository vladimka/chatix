import React, { useState } from 'react';
import './InviteModal.css';

const InviteModal = ({ room, onClose, onInvite, onCreateLink }) => {
  const [inviteType, setInviteType] = useState('user'); // 'user' или 'link'
  const [username, setUsername] = useState('');
  const [linkOptions, setLinkOptions] = useState({
    maxUses: 1,
    expiresIn: 7 // дней
  });
  const [generatedLink, setGeneratedLink] = useState(null);

  const handleInviteUser = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onInvite(username.trim());
      setUsername('');
      onClose();
    }
  };

  const handleCreateLink = () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + linkOptions.expiresIn);
    
    onCreateLink({
      maxUses: linkOptions.maxUses,
      expiresAt
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Ссылка скопирована в буфер обмена!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            🔗 Пригласить в комнату
            <span className="room-name-badge">#{room.name}</span>
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Переключатель типа приглашения */}
        <div className="invite-type-selector">
          <button 
            className={`type-btn ${inviteType === 'user' ? 'active' : ''}`}
            onClick={() => setInviteType('user')}
          >
            👤 Пригласить пользователя
          </button>
          <button 
            className={`type-btn ${inviteType === 'link' ? 'active' : ''}`}
            onClick={() => setInviteType('link')}
          >
            🔗 Создать ссылку-приглашение
          </button>
        </div>

        <div className="invite-content">
          {/* Приглашение пользователя */}
          {inviteType === 'user' && (
            <form onSubmit={handleInviteUser} className="invite-user-form">
              <div className="form-group">
                <label>Имя пользователя</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите ник пользователя"
                  autoFocus
                  required
                />
              </div>

              {room.isPrivate && (
                <div className="info-message">
                  ℹ️ Пользователь автоматически получит доступ к приватной комнате
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={onClose}>
                  Отмена
                </button>
                <button type="submit" className="invite-btn">
                  Отправить приглашение
                </button>
              </div>
            </form>
          )}

          {/* Создание ссылки-приглашения */}
          {inviteType === 'link' && !generatedLink && (
            <div className="create-link-form">
              <div className="form-group">
                <label>Максимальное количество использований</label>
                <select
                  value={linkOptions.maxUses}
                  onChange={(e) => setLinkOptions({
                    ...linkOptions, 
                    maxUses: parseInt(e.target.value)
                  })}
                >
                  <option value="1">1 раз</option>
                  <option value="5">5 раз</option>
                  <option value="10">10 раз</option>
                  <option value="0">Без ограничений</option>
                </select>
              </div>

              <div className="form-group">
                <label>Срок действия</label>
                <select
                  value={linkOptions.expiresIn}
                  onChange={(e) => setLinkOptions({
                    ...linkOptions, 
                    expiresIn: parseInt(e.target.value)
                  })}
                >
                  <option value="1">1 день</option>
                  <option value="3">3 дня</option>
                  <option value="7">7 дней</option>
                  <option value="30">30 дней</option>
                </select>
              </div>

              {room.isPrivate && (
                <div className="warning-message">
                  ⚠️ Ссылка дает доступ к приватной комнате. Будьте осторожны!
                </div>
              )}

              <div className="modal-actions">
                <button className="cancel-btn" onClick={onClose}>
                  Отмена
                </button>
                <button className="create-link-btn" onClick={handleCreateLink}>
                  Создать ссылку
                </button>
              </div>
            </div>
          )}

          {/* Показать сгенерированную ссылку */}
          {generatedLink && (
            <div className="generated-link-container">
              <div className="success-message">
                ✅ Ссылка успешно создана!
              </div>
              
              <div className="link-box">
                <input 
                  type="text" 
                  value={generatedLink} 
                  readOnly 
                  className="link-input"
                />
                <button 
                  className="copy-btn"
                  onClick={() => copyToClipboard(generatedLink)}
                >
                  📋 Копировать
                </button>
              </div>

              <div className="link-info">
                <div className="info-row">
                  <span>Действительна:</span>
                  <span>{linkOptions.maxUses === 0 ? '∞' : linkOptions.maxUses} использований</span>
                </div>
                <div className="info-row">
                  <span>Истекает:</span>
                  <span>
                    {new Date(Date.now() + linkOptions.expiresIn * 24 * 60 * 60 * 1000)
                      .toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={onClose}>
                  Закрыть
                </button>
                <button 
                  className="create-another-btn"
                  onClick={() => setGeneratedLink(null)}
                >
                  Создать еще
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Дополнительная информация для приватных комнат */}
        {room.isPrivate && (
          <div className="privacy-note">
            <h4>🔒 Приватная комната</h4>
            <p>
              Только приглашенные пользователи могут присоединиться к этой комнате.
              Приглашения можно отправлять только участникам, которые уже в сети.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteModal;