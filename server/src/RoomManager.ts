import type { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.ts';
import { STALE_ROOM_CLEANUP_MS } from './config.ts';
import type { RoomConfig, RoomInfo, LobbyPlayer } from './shared/protocol.ts';
import crypto from 'node:crypto';

export class RoomManager {
  private rooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // playerId -> roomId
  private cleanupInterval: ReturnType<typeof setInterval>;
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    // Clean up stale rooms every minute
    this.cleanupInterval = setInterval(() => this.cleanupStaleRooms(), 60_000);
  }

  private generateRoomId(): string {
    // 6-char human-friendly ID
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 for readability
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    // Ensure uniqueness
    if (this.rooms.has(id)) return this.generateRoomId();
    return id;
  }

  generatePlayerId(): string {
    return crypto.randomUUID();
  }

  generateReconnectToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  createRoom(playerId: string, playerName: string, socket: Socket, reconnectToken: string, config?: Partial<RoomConfig>): GameRoom | null {
    // Check if player is already in a room
    if (this.playerRooms.has(playerId)) {
      return null;
    }

    const roomId = this.generateRoomId();
    const room = new GameRoom(this.io, roomId, config);
    room.addPlayer(playerId, playerName, socket, reconnectToken);

    this.rooms.set(roomId, room);
    this.playerRooms.set(playerId, roomId);

    return room;
  }

  joinRoom(roomId: string, playerId: string, playerName: string, socket: Socket, reconnectToken: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.inGame) return null;

    // Check if player is already in a room
    if (this.playerRooms.has(playerId)) {
      const existingRoomId = this.playerRooms.get(playerId)!;
      if (existingRoomId !== roomId) {
        return null; // Already in a different room
      }
    }

    const success = room.addPlayer(playerId, playerName, socket, reconnectToken);
    if (success) {
      this.playerRooms.set(playerId, roomId);
      return room;
    }
    return null;
  }

  leaveRoom(playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.removePlayer(playerId);
      // Clean up empty rooms
      if (room.isEmpty) {
        this.rooms.delete(roomId);
      }
    }
    this.playerRooms.delete(playerId);
  }

  handleDisconnect(playerId: string): void {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.handleDisconnect(playerId);
      // If room is empty and not in game, clean up
      if (room.isEmpty && !room.inGame) {
        this.rooms.delete(roomId);
        this.playerRooms.delete(playerId);
      }
    }
  }

  attemptReconnect(playerId: string, socket: Socket, token: string, roomId: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const success = room.handleReconnect(playerId, socket, token);
    if (success) {
      this.playerRooms.set(playerId, roomId);
      return room;
    }
    return null;
  }

  getRoom(roomId: string): GameRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  getRoomForPlayer(playerId: string): GameRoom | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    return this.rooms.get(roomId) ?? null;
  }

  listRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    for (const [roomId, room] of this.rooms) {
      if (!room.inGame) {
        rooms.push({
          roomId,
          playerCount: room.playerCount,
          maxPlayers: room.config.maxPlayers,
          inGame: room.inGame,
        });
      }
    }
    return rooms;
  }

  private cleanupStaleRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (room.isEmpty && now - room.lastActivityAt > STALE_ROOM_CLEANUP_MS) {
        // Clean up player mappings
        for (const [pid, rid] of this.playerRooms) {
          if (rid === roomId) {
            this.playerRooms.delete(pid);
          }
        }
        this.rooms.delete(roomId);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
