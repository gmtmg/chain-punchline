import type {
  Room,
  ServerMessage,
  ReactionType,
  AnswerOption,
} from "../../shared/types";
import {
  BEAT_DURATIONS,
  REVEAL_CARD_INTRO,
  REVEAL_FIELD,
  REACTION_WINDOW,
  MIN_PLAYERS,
  MAX_FIELD_LENGTH,
  WRITING_ROUNDS,
  REACTION_BUDGET,
} from "../../shared/constants";
import type { BeatLevel } from "../../shared/constants";
import { setRoomTimer, clearAllRoomTimers } from "./timer";
import { createCards, getAssignments } from "./cards";
import { tallyReactions } from "./scoring";
import { getTopics } from "../data/prompts";
import { drawAnswerCards } from "../data/answers";
import { resetForNewGame } from "./room";

// Per-room dealt cards: roomCode → Map<playerId, AnswerOption[]>
const dealtCardsMap = new Map<string, Map<string, AnswerOption[]>>();

type Broadcaster = (roomCode: string, msg: ServerMessage) => void;
type Sender = (playerId: string, msg: ServerMessage) => void;

let broadcast: Broadcaster;
let sendTo: Sender;

export function initState(b: Broadcaster, s: Sender) {
  broadcast = b;
  sendTo = s;
}

// ── Start Game ──

export function startGame(room: Room, beatLevel: BeatLevel = 1): string | null {
  if (room.players.size < MIN_PLAYERS) {
    return `最低${MIN_PLAYERS}人必要です`;
  }
  room.beatLevel = beatLevel;
  resetForNewGame(room);

  const playerCount = room.players.size;
  const topics = getTopics(playerCount, room.usedTopics);
  createCards(room, topics);

  // 3-2-1 countdown then start
  broadcast(room.code, { type: "countdown", count: 3 });
  setRoomTimer(room.code, "countdown-2", () => {
    broadcast(room.code, { type: "countdown", count: 2 });
  }, 1000);
  setRoomTimer(room.code, "countdown-1", () => {
    broadcast(room.code, { type: "countdown", count: 1 });
  }, 2000);
  setRoomTimer(room.code, "countdown-go", () => {
    startWritingRound(room, 1);
  }, 3000);
  return null;
}

// ── Writing Phase ──

function startWritingRound(room: Room, round: number): void {
  const duration = BEAT_DURATIONS[room.beatLevel] || BEAT_DURATIONS[1];
  room.phase = "writing";
  room.writingState = {
    round,
    deadline: Date.now() + duration,
    submitted: new Set(),
  };

  const assignments = getAssignments(room, round);
  const fieldIndex = round - 1; // round 1 → field 0, etc.
  const isFree = room.gameMode === "free";

  // Deal answer cards to each player (card mode only)
  if (!isFree) {
    const roomDealt = new Map<string, AnswerOption[]>();
    for (const [playerId] of assignments) {
      const hand = drawAnswerCards(round);
      roomDealt.set(playerId, hand);
    }
    dealtCardsMap.set(room.code, roomDealt);
  }

  for (const [playerId, cardId] of assignments) {
    const card = room.cards.find((c) => c.id === cardId)!;
    const hand = isFree ? [] : (dealtCardsMap.get(room.code)?.get(playerId) || []);
    sendTo(playerId, {
      type: "writing_start",
      round,
      cardId: card.id,
      topic: card.topic,
      previousFields: card.fields.slice(0, fieldIndex),
      fieldIndex,
      deadline: duration,
      answerOptions: hand,
      gameMode: room.gameMode,
    });
  }

  setRoomTimer(
    room.code,
    `writing-${round}`,
    () => endWritingRound(room),
    duration
  );
}

function endWritingRound(room: Room): void {
  if (!room.writingState) return;
  const round = room.writingState.round;
  const fieldIndex = round - 1;
  const assignments = getAssignments(room, round);

  console.log(`[state] endWritingRound round=${round}, WRITING_ROUNDS=${WRITING_ROUNDS}`);

  // Auto-fill for players who didn't submit: "..." (てんてんてん)
  for (const [playerId, cardId] of assignments) {
    if (!room.writingState.submitted.has(playerId)) {
      const card = room.cards.find((c) => c.id === cardId)!;
      card.fields[fieldIndex] = "...";
      card.authorIds[fieldIndex] = playerId;
    }
  }

  if (round < WRITING_ROUNDS) {
    console.log(`[state] → startWritingRound(${round + 1})`);
    startWritingRound(room, round + 1);
  } else {
    console.log(`[state] → startReveal`);
    startReveal(room);
  }
}

// ── Reveal Phase ──

function startReveal(room: Room): void {
  console.log(`[state] startReveal: ${room.cards.length} cards`);
  room.phase = "reveal";
  room.writingState = null;
  room.revealState = {
    currentCardIndex: 0,
    currentFieldIndex: -1,
  };
  revealNextCard(room);
}

function revealNextCard(room: Room): void {
  const state = room.revealState!;
  const cardIndex = state.currentCardIndex;

  console.log(`[state] revealNextCard: cardIndex=${cardIndex}, totalCards=${room.cards.length}`);

  if (cardIndex >= room.cards.length) {
    console.log(`[state] all cards revealed → showResults`);
    showResults(room);
    return;
  }

  const card = room.cards[cardIndex];
  const originPlayer = room.players.get(card.originPlayerId);

  state.currentFieldIndex = -1;

  const authorNames = card.authorIds.map((aid) => {
    const p = room.players.get(aid);
    return p ? p.name : "???";
  }) as [string, string, string];

  console.log(`[state] broadcasting reveal_card_start: card=${card.id}, topic=${card.topic}, authorNames=`, authorNames);

  broadcast(room.code, {
    type: "reveal_card_start",
    cardIndex,
    totalCards: room.cards.length,
    topic: card.topic,
    originPlayerName: originPlayer?.name || "???",
    authorNames,
  });

  setRoomTimer(
    room.code,
    "reveal-card-intro",
    () => revealNextField(room),
    REVEAL_CARD_INTRO
  );
}

function revealNextField(room: Room): void {
  const state = room.revealState!;
  state.currentFieldIndex++;
  const fieldIndex = state.currentFieldIndex;
  const cardIndex = state.currentCardIndex;
  const card = room.cards[cardIndex];

  console.log(`[state] revealNextField: card=${cardIndex}, field=${fieldIndex}`);

  if (fieldIndex >= 3) {
    // All fields revealed for this card — reaction window
    console.log(`[state] card ${cardIndex} done → reaction window (${REACTION_WINDOW}ms)`);
    broadcast(room.code, {
      type: "reveal_card_done",
      cardIndex,
    });
    setRoomTimer(
      room.code,
      "reaction-window",
      () => {
        state.currentCardIndex++;
        revealNextCard(room);
      },
      REACTION_WINDOW
    );
    return;
  }

  const authorPlayer = room.players.get(card.authorIds[fieldIndex]);

  broadcast(room.code, {
    type: "reveal_field",
    cardIndex,
    fieldIndex,
    text: card.fields[fieldIndex],
    authorName: authorPlayer?.name || "???",
  });

  setRoomTimer(
    room.code,
    "reveal-field",
    () => revealNextField(room),
    REVEAL_FIELD
  );
}

// ── Results ──

function showResults(room: Room): void {
  console.log(`[state] showResults`);
  room.phase = "results";
  room.revealState = null;

  const rankings = tallyReactions(room);

  console.log(`[state] broadcasting results: ${rankings.length} cards ranked`);
  broadcast(room.code, {
    type: "results",
    rankings,
  });
}

// ── Handle Submit Field ──

export function handleSubmitField(
  room: Room,
  playerId: string,
  cardId: string,
  answerId: string,
  freeText?: string
): string | null {
  if (room.phase !== "writing") return "記入フェーズではありません";
  if (!room.writingState) return "記入フェーズではありません";

  const ws = room.writingState;

  // Check already submitted
  if (ws.submitted.has(playerId)) return "既に提出済みです";

  // Verify assignment
  const assignments = getAssignments(room, ws.round);
  const assignedCardId = assignments.get(playerId);
  if (assignedCardId !== cardId) return "このカードには記入できません";

  const card = room.cards.find((c) => c.id === cardId)!;
  const fieldIndex = ws.round - 1;

  if (room.gameMode === "free") {
    // Free text mode
    const text = (freeText || "").trim();
    if (!text) return "テキストを入力してください";
    if (text.length > MAX_FIELD_LENGTH) return `${MAX_FIELD_LENGTH}文字以内で入力してください`;
    card.fields[fieldIndex] = text;
    card.authorIds[fieldIndex] = playerId;
  } else {
    // Card mode — validate answerId against dealt hand
    const roomDealt = dealtCardsMap.get(room.code);
    const hand = roomDealt?.get(playerId);
    if (!hand) return "手札が見つかりません";
    const chosen = hand.find((a) => a.id === answerId);
    if (!chosen) return "無効な回答カードです";
    card.fields[fieldIndex] = chosen.text;
    card.authorIds[fieldIndex] = playerId;
  }

  ws.submitted.add(playerId);

  // Broadcast progress
  broadcast(room.code, {
    type: "field_submitted",
    playerId,
    submittedCount: ws.submitted.size,
    totalCount: room.players.size,
  });

  // Wait for timer to expire — no early end
  return null;
}

// ── Handle Reaction ──

export function handleReaction(
  room: Room,
  playerId: string,
  cardId: string,
  reactionType: ReactionType
): string | null {
  if (room.phase !== "reveal") return "リアクションフェーズではありません";

  const player = room.players.get(playerId);
  if (!player) return "プレイヤーが見つかりません";

  // Budget check
  const remaining = player.reactionBudget[reactionType];
  if (remaining <= 0) return "リアクションの残り回数がありません";

  const card = room.cards.find((c) => c.id === cardId);
  if (!card) return "カードが見つかりません";

  // Duplicate check: same player, same card, same type
  const alreadySent = card.reactions.some(
    (r) => r.playerId === playerId && r.type === reactionType
  );
  if (alreadySent) return "既に同じリアクションを送っています";

  // Deduct budget
  player.reactionBudget[reactionType]--;

  // Record reaction
  card.reactions.push({ playerId, type: reactionType });

  // Broadcast to all
  broadcast(room.code, {
    type: "reaction",
    cardId,
    playerId,
    playerName: player.name,
    reactionType,
  });

  return null;
}

// ── Return to Lobby ──

export function returnToLobby(room: Room): void {
  clearAllRoomTimers(room.code);
  room.phase = "lobby";
  room.cards = [];
  room.writingState = null;
  room.revealState = null;
}
