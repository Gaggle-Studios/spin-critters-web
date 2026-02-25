# NETWORKING.md - Multiplayer Architecture

## Overview

Authoritative server model using WebSockets (Socket.io). The existing pure game engine (`src/engine/`, zero React deps) runs on the server. Clients send player actions, the server validates and executes them, then broadcasts sanitized game state to all connected players. Supports mixed human + AI players.

## Target Architecture

**Monorepo with 3 packages:**

```
packages/
  shared/     # Current src/engine/ + src/data/ + protocol types
              # No Node.js-specific or browser-specific imports
  server/     # Node.js + Socket.io authoritative game server
  client/     # Current React app, Zustand store rewritten for network
```

**Dependencies:**

```
server:  socket.io, tsx (dev runner), typescript
client:  socket.io-client (add to existing)
shared:  no new deps (pure TypeScript)
root:    concurrently (run server + client dev together)
```

## Project Structure

```
spin-critters/
  packages/
    shared/
      src/
        types.ts           # Current engine/types.ts + PlayerPhaseData
        constants.ts       # Current engine/constants.ts
        cards.ts           # Current engine/cards.ts (refactored: no module-level state)
        battle.ts          # Current engine/battle.ts
        shop.ts            # Current engine/shop.ts
        ai.ts              # Current engine/ai.ts
        gameState.ts       # Current engine/gameState.ts (refactored for multiplayer)
        protocol.ts        # NEW: Client<->Server message types
        index.ts           # Barrel export
      data/
        critters.json
      package.json         # { "name": "@spin-critters/shared" }
      tsconfig.json

    server/
      src/
        index.ts               # HTTP + Socket.io server entry point
        GameRoom.ts            # Room/session wrapping engine state
        RoomManager.ts         # Lobby: create/join/list rooms
        PlayerConnection.ts    # Per-player socket state + reconnection tokens
        AIPlayerController.ts  # Drives AI turns using engine/ai.ts
        ActionValidator.ts     # Validates client actions against game state
        StateSanitizer.ts      # Strips opponent hidden info before sending
        config.ts              # Server configuration
      package.json             # { "name": "@spin-critters/server" }
      tsconfig.json

    client/
      src/
        components/            # Current components (mostly unchanged)
        store/
          gameStore.ts         # REWRITTEN: network-backed instead of local engine
        networking/
          SocketManager.ts     # Socket.io connection, reconnection, message routing
          useSocket.ts         # React hook for connection state
        App.tsx
        main.tsx
      package.json             # { "name": "@spin-critters/client" }
      vite.config.ts
      tsconfig.json

  package.json                 # Workspace root
  tsconfig.base.json           # Shared TypeScript config
```

## Protocol

All messages use a discriminated union on the `type` field. Adding new game phases or actions means adding new union members -- no structural changes to the transport layer.

### Client -> Server Messages

| Type | Payload | Phase |
|------|---------|-------|
| `create-room` | `playerName`, `config?` | Lobby |
| `join-room` | `roomId`, `playerName` | Lobby |
| `leave-room` | -- | Lobby |
| `set-ready` | `ready` | Lobby |
| `select-critters` | `critterIds[]`, `columnPlacements[]` | critter-select |
| `draft-pick` | `cardIndex`, `column` | initial-draft |
| `request-spin` | -- | battle |
| `end-battle` | -- | battle |
| `shop-buy` | `cardIndex`, `column` | shop |
| `shop-reroll` | -- | shop |
| `shop-skip` | -- | shop |
| `reconnect` | `token`, `roomId` | Any |

### Server -> Client Messages

| Type | Payload | When |
|------|---------|------|
| `connected` | `playerId`, `reconnectToken` | On connect |
| `error` | `code`, `message` | On invalid action |
| `room-created` | `roomId` | After create-room |
| `room-joined` | `roomId`, `players[]` | After join-room |
| `room-updated` | `players[]` | Player join/leave/ready |
| `game-state` | `SanitizedTournamentState` | Full sync (join, reconnect, phase change) |
| `game-delta` | `GameDelta` | Incremental updates within a phase |
| `battle-events` | `BattleEvent[]` | After spin (forwarded for animation) |
| `phase-change` | `phase`, `SanitizedTournamentState` | On phase transition |
| `waiting-for` | `playerIds[]`, `action`, `timeoutMs?` | When server needs player input |
| `player-disconnected` | `playerId` | When a player disconnects |
| `player-reconnected` | `playerId` | When a player reconnects |

### Error Codes

`ROOM_NOT_FOUND`, `ROOM_FULL`, `INVALID_ACTION`, `NOT_YOUR_TURN`, `INSUFFICIENT_RESOURCES`, `INVALID_PLACEMENT`, `GAME_NOT_STARTED`, `RECONNECT_FAILED`, `RATE_LIMITED`

## State Sanitization

Each player receives a personalized view of the game state:

- **Your own reels**: Full grid data (all rows, all cards with stats)
- **Opponent reels**: Summary only (card count per column, living count per column)
- **Battle active cards**: Visible to both players (they're on the public battle line)
- **Draft packs / shop packs**: Only your own
- **Morale and resources**: Visible for all players

This prevents information leaking (opponents can't see your reel composition to game their strategy).

## Engine Refactoring for Multiplayer

The current engine hardcodes `humanPlayerId` in `gameState.ts`. For multiplayer:

1. All action functions accept a `playerId` parameter instead of assuming the human player
2. Per-player state (draft packs, shop packs, pending placement) moves from `TournamentState` globals to a `PlayerPhaseData` map keyed by player ID
3. `startNextBattle` supports arbitrary player pairings (not just human-vs-AI)
4. Module-level mutable counters in `cards.ts` are replaced with session-scoped or UUID-based IDs
5. Backward compatibility: single-player mode passes `'human'` as the playerId

## Server Components

### RoomManager
- Creates rooms with 6-char human-friendly IDs
- Tracks active rooms, handles cleanup of stale rooms (empty > 5 min)
- Configurable: max players (2-8), AI slot count, turn timeout, private/public

### GameRoom
- Wraps a `TournamentState` instance
- Receives validated player actions, calls engine functions, broadcasts results
- Manages AI player controllers (runs AI turns with 500-1000ms artificial delay)
- Handles phase transitions and turn management

### ActionValidator
- Validates every client action before engine processes it
- Checks: correct phase, correct player's turn, valid parameters, sufficient resources
- Returns typed error codes on failure

### AIPlayerController
- Wraps existing `ai.ts` functions
- Executes AI decisions server-side without network round-trips
- Small artificial delay between AI actions for natural feel

## Reconnection Strategy

1. Server assigns `reconnectToken` on initial connect (random 64-byte hex)
2. Client stores token + room ID in `sessionStorage`
3. On disconnect: server marks player `isConnected: false`, starts 5-minute timer
4. Socket.io handles transport reconnection automatically
5. After transport reconnects, client sends `reconnect` message with stored token
6. Server validates token, re-associates socket, sends full `game-state` sync
7. If 5-minute timer expires: player permanently replaced by AI
8. Turn timeouts (60s): if disconnected player's turn, server auto-acts using AI fallback

## Client Changes

### Zustand Store Rewrite
The store interface (action names, state shape) stays nearly identical. The difference:
- **Before**: Actions call engine functions directly, state is computed locally
- **After**: Actions send messages to server, state comes from server via `game-state` messages

### Components That Need Changes
- `GameBoard.tsx` -- add lobby/connection screen before `critter-select`
- New `LobbyView.tsx` -- room creation, joining, ready-up UI

### Components That Need NO Changes
`CardSlot`, `ReelGrid`, `ReelSpinner`, `BattleLog`, `StatusBar`, `BattleEventOverlay`, `CardZoom`, `useAnimationQueue`, `useProgressiveDisplay` -- all read from the same Zustand store shape.

## What Depends on Game Requirements Changes

The networking infrastructure is designed to absorb game rule changes gracefully. These specific areas will need updating:

- **New action types**: Add new union members to `ClientMessage` / `ServerMessage`
- **Draft mechanic changes**: If changed from private packs to shared pool, update draft orchestration in `GameRoom`
- **Battle interaction model**: Who clicks spin in 1v1 affects `waiting-for` logic
- **Simultaneous battles**: If multiple battles run in parallel, `GameRoom` manages multiple `BattleState` instances
- **New game phases**: Add message types + server handler + UI component

None of these require changes to the transport layer, reconnection system, lobby, or room management.

## Implementation Order

1. **Monorepo setup** -- restructure into packages, fix imports, verify builds
2. **Protocol types** -- define all message types in `shared/src/protocol.ts`
3. **Engine generalization** -- remove `humanPlayerId` hardcoding, add `playerId` params
4. **Server core** -- RoomManager, GameRoom, ActionValidator, StateSanitizer, AIPlayerController
5. **Client networking** -- SocketManager, rewrite Zustand store, LobbyView
6. **Reconnection** -- token management, disconnect timers, AI takeover
7. **Integration testing** -- multi-tab testing, disconnect/reconnect, full game flow
