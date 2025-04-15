import React from 'react';

interface Props {
  isConnected: boolean;
  message: string;
}

const StatusBar: React.FC<Props> = ({ isConnected, message }) => {
  return (
    <div className={`status-bar ${isConnected ? 'connected' : 'disconnected'}`}>
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'online' : 'offline'}`}></div>
      </div>
      {message && <div className="status-message">{message}</div>}
    </div>
  );
};

export default StatusBar;