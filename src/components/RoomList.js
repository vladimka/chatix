import React, { useState } from 'react';
import './RoomList.css';

const RoomList = ({ rooms, currentRoom, onRoomSelect }) => {
  const [filter, setFilter] = useState('all'); // all, public, private

  const filteredRooms = rooms.filter(room => {
    if (filter === 'public') return !room.isPrivate;
    if (filter === 'private') return room.isPrivate;
    return true;
  });

  const groupedRooms = {
    public: filteredRooms.filter(r => !r.isPrivate),
    private: filteredRooms.filter(r => r.isPrivate)
  };

  const RoomItem = ({ room }) => (
    <div 
      className={`room-item ${currentRoom?._id === room._id ? 'active' : ''}`}
      onClick={() => onRoomSelect(room)}
      onTouchEnd={(e) => {
        e.preventDefault();
        onRoomSelect(room);
      }}
    >
      <div className="room-icon">
        {room.isPrivate ? '🔒' : '#'}
      </div>
      <div className="room-info">
        <div className="room-name">{room.name}</div>
        <div className="room-meta">
          <span>{room.members?.length || 0} участников</span>
          <span>{room.messageCount || 0} сообщ.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="room-list">
      <div className="room-filters">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        <button 
          className={`filter-btn ${filter === 'public' ? 'active' : ''}`}
          onClick={() => setFilter('public')}
        >
          Публичные
        </button>
        <button 
          className={`filter-btn ${filter === 'private' ? 'active' : ''}`}
          onClick={() => setFilter('private')}
        >
          Приватные
        </button>
      </div>

      {groupedRooms.public.length > 0 && (
        <div className="room-group">
          <h4>Публичные комнаты</h4>
          {groupedRooms.public.map(room => (
            <RoomItem key={room._id} room={room} />
          ))}
        </div>
      )}

      {groupedRooms.private.length > 0 && (
        <div className="room-group">
          <h4>Приватные комнаты</h4>
          {groupedRooms.private.map(room => (
            <RoomItem key={room._id} room={room} />
          ))}
        </div>
      )}

      {filteredRooms.length === 0 && (
        <div className="no-rooms">
          <p>Нет доступных комнат</p>
        </div>
      )}
    </div>
  );
};

export default RoomList;