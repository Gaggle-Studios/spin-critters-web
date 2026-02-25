import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.ts';
import { SERVER_PORT, CORS_ORIGINS } from './config.ts';
import type { ClientMessage, ServerMessage } from '../../src/shared/protocol.ts';

const httpServer = createServer((_req, res) => {
  // Health check endpoint
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const roomManager = new RoomManager(io);

// Track socket -> playerId mapping
const socketPlayerMap = new Map<string, string>();

io.on('connection', (socket) => {
  const playerId = roomManager.generatePlayerId();
  const reconnectToken = roomManager.generateReconnectToken();
  socketPlayerMap.set(socket.id, playerId);

  console.log(`Player connected: ${playerId} (socket: ${socket.id})`);

  // Send connection confirmation
  const connected: ServerMessage = {
    type: 'connected',
    playerId,
    reconnectToken,
  };
  socket.emit('message', connected);

  // Handle all client messages
  socket.on('message', (msg: ClientMessage) => {
    const pid = socketPlayerMap.get(socket.id);
    if (!pid) return;

    try {
      handleMessage(pid, socket, reconnectToken, msg);
    } catch (err) {
      console.error(`Error handling message from ${pid}:`, err);
      const errorMsg: ServerMessage = {
        type: 'error',
        code: 'INVALID_ACTION',
        message: 'Internal server error',
      };
      socket.emit('message', errorMsg);
    }
  });

  socket.on('disconnect', () => {
    const pid = socketPlayerMap.get(socket.id);
    if (!pid) return;

    console.log(`Player disconnected: ${pid} (socket: ${socket.id})`);
    roomManager.handleDisconnect(pid);
    socketPlayerMap.delete(socket.id);
  });
});

function handleMessage(playerId: string, socket: import('socket.io').Socket, reconnectToken: string, msg: ClientMessage): void {
  switch (msg.type) {
    case 'create-room': {
      if (!msg.playerName) {
        const err: ServerMessage = { type: 'error', code: 'NAME_REQUIRED', message: 'Player name is required' };
        socket.emit('message', err);
        return;
      }
      const room = roomManager.createRoom(playerId, msg.playerName, socket, reconnectToken, msg.config);
      if (!room) {
        const err: ServerMessage = { type: 'error', code: 'ALREADY_IN_ROOM', message: 'Already in a room' };
        socket.emit('message', err);
        return;
      }
      const created: ServerMessage = { type: 'room-created', roomId: room.roomId };
      socket.emit('message', created);
      const joined: ServerMessage = { type: 'room-joined', roomId: room.roomId, players: room.getLobbyPlayers() };
      socket.emit('message', joined);
      break;
    }

    case 'join-room': {
      if (!msg.playerName) {
        const err: ServerMessage = { type: 'error', code: 'NAME_REQUIRED', message: 'Player name is required' };
        socket.emit('message', err);
        return;
      }
      const room = roomManager.joinRoom(msg.roomId.toUpperCase(), playerId, msg.playerName, socket, reconnectToken);
      if (!room) {
        const err: ServerMessage = { type: 'error', code: 'ROOM_NOT_FOUND', message: 'Room not found or full' };
        socket.emit('message', err);
        return;
      }
      const joined: ServerMessage = { type: 'room-joined', roomId: room.roomId, players: room.getLobbyPlayers() };
      socket.emit('message', joined);
      break;
    }

    case 'leave-room': {
      roomManager.leaveRoom(playerId);
      break;
    }

    case 'reconnect': {
      const room = roomManager.attemptReconnect(playerId, socket, msg.token, msg.roomId);
      if (!room) {
        const err: ServerMessage = { type: 'error', code: 'RECONNECT_FAILED', message: 'Reconnection failed' };
        socket.emit('message', err);
      }
      break;
    }

    default: {
      // Route to the player's room
      const room = roomManager.getRoomForPlayer(playerId);
      if (!room) {
        const err: ServerMessage = { type: 'error', code: 'GAME_NOT_STARTED', message: 'Not in a room' };
        socket.emit('message', err);
        return;
      }
      room.handleMessage(playerId, msg);
      break;
    }
  }
}

httpServer.listen(SERVER_PORT, () => {
  console.log(`Spin Critters server running on port ${SERVER_PORT}`);
  console.log(`CORS origins: ${CORS_ORIGINS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  roomManager.destroy();
  io.close();
  httpServer.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  roomManager.destroy();
  io.close();
  httpServer.close();
  process.exit(0);
});
