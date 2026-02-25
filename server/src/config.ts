export const SERVER_PORT = parseInt(process.env.PORT || '3001', 10);
export const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:4173', 'https://spin-critters.vercel.app'];
export const RECONNECT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const STALE_ROOM_CLEANUP_MS = 5 * 60 * 1000; // 5 minutes
export const AI_ACTION_DELAY_MS = 800; // Artificial delay for AI actions
export const SPIN_READY_TIMEOUT_MS = 3000; // Auto-spin after 3 seconds
export const TURN_TIMEOUT_MS = 60000; // 60 seconds per turn
