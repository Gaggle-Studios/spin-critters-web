import { io, Socket } from 'socket.io-client';
import type { ClientMessage, ServerMessage } from '../shared/protocol.ts';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type MessageHandler = (message: ServerMessage) => void;

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class SocketManagerClass {
  private socket: Socket | null = null;
  private handlers: Set<MessageHandler> = new Set();
  private _status: ConnectionStatus = 'disconnected';
  private _playerId: string | null = null;
  private _reconnectToken: string | null = null;
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  get status(): ConnectionStatus {
    return this._status;
  }

  get playerId(): string | null {
    return this._playerId;
  }

  get reconnectToken(): string | null {
    return this._reconnectToken;
  }

  connect(): void {
    if (this.socket?.connected) return;

    this._status = 'connecting';
    this.notifyStatusListeners();

    this.socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[SocketManager] Connected to server');
    });

    this.socket.on('message', (msg: ServerMessage) => {
      // Handle connection message specially
      if (msg.type === 'connected') {
        this._playerId = msg.playerId;
        this._reconnectToken = msg.reconnectToken;
        this._status = 'connected';
        this.notifyStatusListeners();

        // Try to reconnect to existing room
        const savedRoom = sessionStorage.getItem('sc_roomId');
        const savedToken = sessionStorage.getItem('sc_reconnectToken');
        const savedPlayerId = sessionStorage.getItem('sc_playerId');
        if (savedRoom && savedToken && savedPlayerId) {
          this.send({
            type: 'reconnect',
            token: savedToken,
            roomId: savedRoom,
          });
        }
      }

      // Save reconnect data
      if (msg.type === 'connected') {
        sessionStorage.setItem('sc_playerId', msg.playerId);
        sessionStorage.setItem('sc_reconnectToken', msg.reconnectToken);
      }
      if (msg.type === 'room-joined' || msg.type === 'room-created') {
        if ('roomId' in msg) {
          sessionStorage.setItem('sc_roomId', msg.roomId);
        }
      }

      // Forward to all handlers
      for (const handler of this.handlers) {
        handler(msg);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[SocketManager] Disconnected from server');
      this._status = 'disconnected';
      this.notifyStatusListeners();
    });

    this.socket.on('connect_error', (err) => {
      console.error('[SocketManager] Connection error:', err.message);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._status = 'disconnected';
    this._playerId = null;
    this._reconnectToken = null;
    sessionStorage.removeItem('sc_roomId');
    sessionStorage.removeItem('sc_reconnectToken');
    sessionStorage.removeItem('sc_playerId');
    this.notifyStatusListeners();
  }

  send(message: ClientMessage): void {
    if (this.socket?.connected) {
      this.socket.emit('message', message);
    } else {
      console.warn('[SocketManager] Cannot send, not connected');
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private notifyStatusListeners(): void {
    for (const listener of this.statusListeners) {
      listener(this._status);
    }
  }
}

// Singleton
export const socketManager = new SocketManagerClass();
