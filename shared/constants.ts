// ── Timing (milliseconds) ──
export type BeatLevel = 1 | 2 | 3;
export const BEAT_DURATIONS: Record<BeatLevel, number> = { 1: 8_000, 2: 6_000, 3: 4_000 };
export const REACTION_WINDOW = 4_000;

// ── TTS-aware reveal timing ──
const TTS_CHARS_PER_SEC_SLOW = 3.5;  // topic: pitch 0.3, rate 0.8
const TTS_CHARS_PER_SEC_NORMAL = 5;  // field: pitch 1.4, rate 1.0

/** Estimate reveal delay so TTS finishes before next event. */
export function revealCardIntroMs(topicText: string): number {
  const clean = topicText.replace(/[・…．\.·•‥]+/g, "").trim();
  // 600ms pre-delay (text visible before speech) + speech + 800ms post-pause
  const speechMs = (clean.length / TTS_CHARS_PER_SEC_SLOW) * 1000;
  return Math.max(600 + speechMs + 800, 3_000);
}

export function revealFieldMs(fieldText: string): number {
  const clean = fieldText.replace(/[・…．\.·•‥]+/g, "").trim();
  const speechMs = (clean.length / TTS_CHARS_PER_SEC_NORMAL) * 1000;
  return Math.max(speechMs + 1_500, 3_000);
}

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
