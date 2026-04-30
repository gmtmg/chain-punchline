// ── Timing (milliseconds) ──
export type BeatLevel = 0 | 1 | 2 | 3;
export const BEAT_DURATIONS: Record<BeatLevel, number> = { 0: 12_000, 1: 8_000, 2: 6_000, 3: 4_000 };
export const REVEAL_CARD_INTRO = 9_000;
export const REVEAL_FIELD = 5_000;
export const REACTION_WINDOW = 8_000;

// ── Game Settings ──
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const MAX_FIELD_LENGTH = 15;
export const WRITING_ROUNDS = 3;
export const ANSWER_CARDS_PER_HAND = 12;

// ── Reactions ──
export const REACTION_BUDGET = {
  kusa: { count: 3, points: 1 },
  warota: { count: 2, points: 2 },
  kusawarota: { count: 1, points: 3 },
} as const;

// ── Room ──
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
