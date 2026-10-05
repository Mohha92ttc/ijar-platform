import { io, type Socket } from 'socket.io-client';
import { getStoredUser } from './api';

type RealtimeNotification = {
  type: string;
  title: string;
  message: string;
  data?: { id?: string; related_id?: string | null; created_at?: string };
};

type Handler = (n: RealtimeNotification) => void;

let socket: Socket | null = null;
const handlers = new Set<Handler>();

export function connectRealtime(): void {
  const user = getStoredUser();
  if (!user?.id) {
    disconnectRealtime();
    return;
  }
  if (socket?.connected) {
    const authUserId = (socket.auth as { userId?: string } | undefined)?.userId;
    if (authUserId === user.id) return;
    disconnectRealtime();
  }

  socket = io({
    path: '/socket.io',
    withCredentials: true,
    auth: { userId: user.id, role: user.role },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('notification', (payload: RealtimeNotification) => {
    handlers.forEach((h) => {
      try {
        h(payload);
      } catch {
        // ignore handler errors
      }
    });
  });
}

export function disconnectRealtime(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function onRealtimeNotification(handler: Handler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}
