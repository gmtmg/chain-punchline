// ── Game State ──

export interface AnswerOption {
  id: string;
  text: string;
}

export type Phase = "lobby" | "writing" | "reveal" | "results";

export type ReactionType = "kusa" | "warota" | "kusawarota";

export interface ReactionBudget {
  kusa: number;
  warota: number;
  kusawarota: number;
}

export interface TopicCard {
  id: string;
  originPlayerId: string;
  topic: string;
  fields: [string, string, string];
  authorIds: [string, string, string];
  reactions: { playerId: string; type: ReactionType }[];
}

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  reactionBudget: ReactionBudget;
}

export interface WritingState {
  round: number; // 1, 2, or 3
  deadline: number; // timestamp
  submitted: Set<string>; // playerIds who submitted this round
}

export interface RevealState {
  currentCardIndex: number;
  currentFieldIndex: number; // -1 = card intro, 0/1/2 = fields
}

export type GameMode = "card" | "free";

export interface Room {
  code: string;
  hostId: string;
  players: Map<string, Player>;
  phase: Phase;
  cards: TopicCard[];
  writingState: WritingState | null;
  revealState: RevealState | null;
  usedTopics: Set<string>;
  currentCategoryId: string;
  beatLevel: 0 | 1 | 2 | 3;
  gameMode: GameMode;
}

// ── Client → Server Messages ──

export interface CreateRoomMsg {
  type: "create_room";
  playerName: string;
}

export interface JoinRoomMsg {
  type: "join_room";
  roomCode: string;
  playerName: string;
}

export interface StartGameMsg {
  type: "start_game";
  beatLevel: 0 | 1 | 2 | 3;
}

export interface SubmitFieldMsg {
  type: "submit_field";
  cardId: string;
  answerId: string;
  freeText?: string;
}

export interface SendReactionMsg {
  type: "send_reaction";
  cardId: string;
  reactionType: ReactionType;
}

export interface BeatSelectMsg {
  type: "beat_select";
}

export interface BeatPreviewMsg {
  type: "beat_preview";
  beatLevel: 0 | 1 | 2 | 3;
}

export interface GameModeSelectMsg {
  type: "game_mode_select";
}

export interface GameModeChangeMsg {
  type: "game_mode_change";
  gameMode: GameMode;
}

export type ClientMessage =
  | CreateRoomMsg
  | JoinRoomMsg
  | StartGameMsg
  | SubmitFieldMsg
  | SendReactionMsg
  | BeatSelectMsg
  | BeatPreviewMsg
  | GameModeSelectMsg
  | GameModeChangeMsg;

// ── Server → Client Messages ──

export interface ErrorMsg {
  type: "error";
  message: string;
}

export interface RoomCreatedMsg {
  type: "room_created";
  roomCode: string;
  playerId: string;
}

export interface PlayerJoinedMsg {
  type: "player_joined";
  playerId: string;
  playerName: string;
  players: { id: string; name: string }[];
}

export interface PlayerLeftMsg {
  type: "player_left";
  playerId: string;
  players: { id: string; name: string }[];
}

export interface JoinedRoomMsg {
  type: "joined_room";
  roomCode: string;
  playerId: string;
  hostId: string;
  players: { id: string; name: string }[];
}

export interface WritingStartMsg {
  type: "writing_start";
  round: number;
  cardId: string;
  topic: string;
  previousFields: string[]; // fields filled in prior rounds
  fieldIndex: number; // which field to fill (0, 1, or 2)
  deadline: number; // ms from now
  answerOptions: AnswerOption[]; // 12 answer cards dealt to this player
  gameMode: GameMode;
}

export interface FieldSubmittedMsg {
  type: "field_submitted";
  playerId: string;
  submittedCount: number;
  totalCount: number;
}

export interface RevealCardStartMsg {
  type: "reveal_card_start";
  cardIndex: number;
  totalCards: number;
  topic: string;
  originPlayerName: string;
  authorNames: [string, string, string];
}

export interface RevealFieldMsg {
  type: "reveal_field";
  cardIndex: number;
  fieldIndex: number;
  text: string;
  authorName: string;
}

export interface ReactionMsg {
  type: "reaction";
  cardId: string;
  playerId: string;
  playerName: string;
  reactionType: ReactionType;
}

export interface RevealCardDoneMsg {
  type: "reveal_card_done";
  cardIndex: number;
}

export interface SpeakMsg {
  type: "speak";
  text: string;
  voice: "low" | "normal";
}

export interface ResultsMsg {
  type: "results";
  rankings: {
    rank: number;
    originPlayerName: string;
    topic: string;
    fields: [string, string, string];
    authorNames: [string, string, string];
    reactionSummary: { kusa: number; warota: number; kusawarota: number };
    totalPoints: number;
  }[];
}

export interface BeatSelectStartMsg {
  type: "beat_select_start";
}

export interface CountdownMsg {
  type: "countdown";
  count: number;
}

export interface BeatPreviewBroadcastMsg {
  type: "beat_preview";
  beatLevel: 0 | 1 | 2 | 3;
}

export interface GameModeSelectStartMsg {
  type: "game_mode_select_start";
}

export interface GameModeChangeBroadcastMsg {
  type: "game_mode_change";
  gameMode: GameMode;
}

export type ServerMessage =
  | ErrorMsg
  | RoomCreatedMsg
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | JoinedRoomMsg
  | WritingStartMsg
  | FieldSubmittedMsg
  | RevealCardStartMsg
  | RevealFieldMsg
  | ReactionMsg
  | RevealCardDoneMsg
  | SpeakMsg
  | ResultsMsg
  | BeatSelectStartMsg
  | BeatPreviewBroadcastMsg
  | CountdownMsg
  | GameModeSelectStartMsg
  | GameModeChangeBroadcastMsg;
