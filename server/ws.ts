import type { ServerWebSocket } from "bun";
import type { ClientMessage, ServerMessage, GameMode } from "../shared/types";
import type { BeatLevel } from "../shared/constants";
import {
  createRoom,
  joinRoom,
  getRoom,
  removePlayer,
  getPlayerList,
} from "./game/room";
import {
  initState,
  startGame,
  handleSubmitField,
  handleReaction,
  returnToLobby,
} from "./game/state";

export interface WSData {
  playerId: string;
  roomCode: string | null;
}

const connections = new Map<string, ServerWebSocket<WSData>>();
let idCounter = 0;

function generatePlayerId(): string {
  return `p-${++idCounter}-${Date.now().toString(36)}`;
}

function send(ws: ServerWebSocket<WSData>, msg: ServerMessage) {
  try {
    ws.send(JSON.stringify(msg));
  } catch (err) {
    console.error("[ws] send error:", err);
  }
}

function sendToPlayer(playerId: string, msg: ServerMessage) {
  const ws = connections.get(playerId);
  if (ws) send(ws, msg);
}

function broadcastToRoom(roomCode: string, msg: ServerMessage) {
  const room = getRoom(roomCode);
  if (!room) return;
  const data = JSON.stringify(msg);
  for (const player of room.players.values()) {
    const ws = connections.get(player.id);
    if (ws) {
      try {
        ws.send(data);
      } catch (err) {
        console.error(`[ws] broadcast error to ${player.id}:`, err);
      }
    }
  }
}

// Initialize state module with broadcast/send functions
initState(broadcastToRoom, sendToPlayer);

export function handleOpen(ws: ServerWebSocket<WSData>) {
  const playerId = generatePlayerId();
  ws.data.playerId = playerId;
  connections.set(playerId, ws);
}

export function handleClose(ws: ServerWebSocket<WSData>) {
  const { playerId, roomCode } = ws.data;
  connections.delete(playerId);
  if (roomCode) {
    const room = removePlayer(roomCode, playerId);
    if (room) {
      broadcastToRoom(roomCode, {
        type: "player_left",
        playerId,
        players: getPlayerList(room),
      });
    }
  }
}

export function handleMessage(
  ws: ServerWebSocket<WSData>,
  raw: string | Buffer
) {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
  } catch {
    send(ws, { type: "error", message: "無効なメッセージです" });
    return;
  }

  const playerId = ws.data.playerId;

  switch (msg.type) {
    case "create_room": {
      const room = createRoom(playerId, msg.playerName);
      ws.data.roomCode = room.code;
      send(ws, { type: "room_created", roomCode: room.code, playerId });
      break;
    }

    case "join_room": {
      const { room, error } = joinRoom(
        msg.roomCode.toUpperCase(),
        playerId,
        msg.playerName
      );
      if (error) {
        send(ws, { type: "error", message: error });
        return;
      }
      ws.data.roomCode = room.code;
      send(ws, {
        type: "joined_room",
        roomCode: room.code,
        playerId,
        hostId: room.hostId,
        players: getPlayerList(room),
      });
      broadcastToRoom(room.code, {
        type: "player_joined",
        playerId,
        playerName: msg.playerName,
        players: getPlayerList(room),
      });
      break;
    }

    case "game_mode_select": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) {
        send(ws, { type: "error", message: "部屋が見つかりません" });
        return;
      }
      if (room.hostId !== playerId) {
        send(ws, { type: "error", message: "ホストのみ操作できます" });
        return;
      }
      broadcastToRoom(room.code, { type: "game_mode_select_start" });
      break;
    }

    case "game_mode_change": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) {
        send(ws, { type: "error", message: "部屋が見つかりません" });
        return;
      }
      if (room.hostId !== playerId) {
        send(ws, { type: "error", message: "ホストのみ操作できます" });
        return;
      }
      const gm = msg.gameMode as GameMode;
      if (gm !== "card" && gm !== "free") return;
      room.gameMode = gm;
      broadcastToRoom(room.code, { type: "game_mode_change", gameMode: gm });
      break;
    }

    case "beat_select": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) {
        send(ws, { type: "error", message: "部屋が見つかりません" });
        return;
      }
      if (room.hostId !== playerId) {
        send(ws, { type: "error", message: "ホストのみ操作できます" });
        return;
      }
      broadcastToRoom(room.code, { type: "beat_select_start" });
      break;
    }

    case "beat_preview": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) return;
      if (room.hostId !== playerId) return;
      broadcastToRoom(room.code, {
        type: "beat_preview",
        beatLevel: msg.beatLevel,
      });
      break;
    }

    case "start_game": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) {
        send(ws, { type: "error", message: "部屋が見つかりません" });
        return;
      }
      if (room.hostId !== playerId) {
        send(ws, { type: "error", message: "ホストのみ開始できます" });
        return;
      }
      const beatLevel = msg.beatLevel ?? 0;
      const err = startGame(room, beatLevel as BeatLevel);
      if (err) send(ws, { type: "error", message: err });
      break;
    }

    case "submit_field": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) return;
      const err = handleSubmitField(room, playerId, msg.cardId, msg.answerId, msg.freeText);
      if (err) send(ws, { type: "error", message: err });
      break;
    }

    case "send_reaction": {
      const room = getRoom(ws.data.roomCode || "");
      if (!room) return;
      const err = handleReaction(
        room,
        playerId,
        msg.cardId,
        msg.reactionType
      );
      if (err) send(ws, { type: "error", message: err });
      break;
    }
  }
}
