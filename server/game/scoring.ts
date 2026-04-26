import type { Room } from "../../shared/types";
import { REACTION_BUDGET } from "../../shared/constants";

export interface CardResult {
  rank: number;
  originPlayerName: string;
  topic: string;
  fields: [string, string, string];
  authorNames: [string, string, string];
  reactionSummary: { kusa: number; warota: number; kusawarota: number };
  totalPoints: number;
}

export function tallyReactions(room: Room): CardResult[] {
  const results: CardResult[] = room.cards.map((card) => {
    const summary = { kusa: 0, warota: 0, kusawarota: 0 };
    for (const r of card.reactions) {
      summary[r.type]++;
    }
    const totalPoints =
      summary.kusa * REACTION_BUDGET.kusa.points +
      summary.warota * REACTION_BUDGET.warota.points +
      summary.kusawarota * REACTION_BUDGET.kusawarota.points;

    const authorNames = card.authorIds.map((aid) => {
      const p = room.players.get(aid);
      return p ? p.name : "???";
    }) as [string, string, string];

    const originPlayer = room.players.get(card.originPlayerId);

    return {
      rank: 0,
      originPlayerName: originPlayer?.name || "???",
      topic: card.topic,
      fields: card.fields,
      authorNames,
      reactionSummary: summary,
      totalPoints,
    };
  });

  results.sort((a, b) => b.totalPoints - a.totalPoints);
  results.forEach((r, i) => (r.rank = i + 1));

  return results;
}
