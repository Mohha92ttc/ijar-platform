import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    role?: string;
  };
}

interface UserNotificationPayload {
  type: string;
  title: string;
  message: string;
  data?: unknown;
}

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, Set<string>> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(v => v.trim()) : false,
        credentials: true,
      },
    });
  }

  async initialize() {
    this.io.use((socket: AuthenticatedSocket, next) => {
      const userId = typeof socket.handshake.auth?.userId === 'string'
        ? socket.handshake.auth.userId
        : undefined;
      const role = typeof socket.handshake.auth?.role === 'string'
        ? socket.handshake.auth.role
        : undefined;

      if (!userId) {
        return next(new Error('Unauthorized socket connection'));
      }

      socket.data.userId = userId;
      socket.data.role = role;
      return next();
    });

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      const userId = socket.data.userId;
      if (!userId) {
        socket.disconnect(true);
        return;
      }

      let userSockets = this.connectedUsers.get(userId);
      if (!userSockets) {
        userSockets = new Set<string>();
        this.connectedUsers.set(userId, userSockets);
      }
      userSockets.add(socket.id);
      socket.join(`user:${userId}`);
      socket.join('all-users');

      if (socket.data.role === 'admin') {
        socket.join('admins');
      }

      socket.on('disconnect', () => {
        const sockets = this.connectedUsers.get(userId);
        if (!sockets) {
          return;
        }
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          this.connectedUsers.delete(userId);
        }
      });
    });

    console.log('WebSocket service initialized');
  }

  async sendNotificationToUser(userId: string, notification: UserNotificationPayload) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  async sendNotificationToAdmins(notification: UserNotificationPayload) {
    this.io.to('admins').emit('notification', notification);
  }

  async broadcastSystemUpdate(update: unknown) {
    this.io.to('all-users').emit('system:update', update);
  }

  async sendChatMessage(bookingId: string, message: unknown) {
    this.io.to(`booking:${bookingId}`).emit('chat:message', message);
  }

  getConnectedUsersCount(): number {
    return Array.from(this.connectedUsers.values()).reduce((total, sockets) => total + sockets.size, 0);
  }

  isUserConnected(userId: string): boolean {
    return (this.connectedUsers.get(userId)?.size ?? 0) > 0;
  }
}
