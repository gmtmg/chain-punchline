import type { Room } from "../../shared/types";

/**
 * Create one TopicCard per player, each assigned a topic from the pool.
 */
export function createCards(room: Room, topics: string[]): void {
  const playerIds = Array.from(room.players.keys());
  room.cards = playerIds.map((pid, i) => ({
    id: `card-${i}`,
    originPlayerId: pid,
    topic: topics[i],
    fields: ["", "", ""] as [string, string, string],
    authorIds: ["", "", ""] as [string, string, string],
    reactions: [],
  }));
}

/**
 * For a given writing round (1-based), return assignments:
 * Map<playerId, cardId> — which card each player writes on.
 *
 * Round 1: player i writes on card i (their own card)
 * Round 2: player i writes on card (i+1) % n
 * Round 3: player i writes on card (i+2) % n
 */
export function getAssignments(
  room: Room,
  writingRound: number
): Map<string, string> {
  const playerIds = Array.from(room.players.keys());
  const n = playerIds.length;
  const assignments = new Map<string, string>();

  for (let i = 0; i < n; i++) {
    const cardIndex = (i + writingRound - 1) % n;
    assignments.set(playerIds[i], room.cards[cardIndex].id);
  }

  return assignments;
}
