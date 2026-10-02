// Opens the Socket.io connection (used for presence, block locks and the sync backup route).
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('syncdoc_token');
    if (!token) return undefined;

    const newSocket = io(SOCKET_URL, {
      auth: { token }
    });
    setSocket(newSocket);

    newSocket.on('connect', () => setConnected(true));
    newSocket.on('disconnect', () => setConnected(false));

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return { socket, connected };
}