import type { Room, Player, ReactionBudget } from "../../shared/types";
import { MAX_PLAYERS, REACTION_BUDGET } from "../../shared/constants";
import { generateRoomCode } from "../utils/room-code";

const rooms = new Map<string, Room>();

export function getRooms(): Map<string, Room> {
  return rooms;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

function freshBudget(): ReactionBudget {
  return {
    kusa: REACTION_BUDGET.kusa.count,
    warota: REACTION_BUDGET.warota.count,
    kusawarota: REACTION_BUDGET.kusawarota.count,
  };
}

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    connected: true,
    reactionBudget: freshBudget(),
  };
}

export function createRoom(hostId: string, hostName: string): Room {
  const code = generateRoomCode(new Set(rooms.keys()));
  const host = createPlayer(hostId, hostName);
  const room: Room = {
    code,
    hostId,
    players: new Map([[hostId, host]]),
    phase: "lobby",
    cards: [],
    writingState: null,
    revealState: null,
    usedTopics: new Set(),
    currentCategoryId: "",
    beatLevel: 0,
    gameMode: "card",
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(
  code: string,
  playerId: string,
  playerName: string
): { room: Room; error?: string } {
  const room = rooms.get(code);
  if (!room) return { room: null!, error: "部屋が見つかりません" };
  if (room.phase !== "lobby")
    return { room: null!, error: "ゲームが既に開始されています" };
  if (room.players.size >= MAX_PLAYERS)
    return { room: null!, error: "部屋が満員です" };

  const player = createPlayer(playerId, playerName);
  room.players.set(playerId, player);
  return { room };
}

export function removePlayer(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(code);
    return null;
  }
  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value!;
  }
  return room;
}

export function getPlayerList(room: Room) {
  return Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
  }));
}

export function resetForNewGame(room: Room): void {
  for (const player of room.players.values()) {
    player.reactionBudget = freshBudget();
  }
  room.cards = [];
  room.writingState = null;
  room.revealState = null;
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}
