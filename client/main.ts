import type { ServerMessage, ReactionType, AnswerOption, GameMode } from "../shared/types";
import { BEAT_DURATIONS, MAX_FIELD_LENGTH } from "../shared/constants";
import { connect, send } from "./ws-client";
import { initAudio, playLobbyBgm, playWaitingBgm, playModeSelectBgm, stopAllBgm, playSE, playWritingBeat, stopWritingBeat, previewBeat, stopPreview, speakTopic, speakField } from "./audio";

// ── State ──
let myPlayerId = "";
let myRoomCode = "";
let isHost = false;
let currentCardId = "";
let hasSubmittedThisRound = false;
let selectedAnswerId = "";
let reactionBudget = { kusa: 3, warota: 2, kusawarota: 1 };
let currentRevealCardId = ""; // track which card is being revealed for reactions
let audioNotified = false; // true after user dismissed audio modal
let selectedBeatLevel: 1 | 2 | 3 = 1;
let selectedGameMode: GameMode = "card";
let currentGameMode: GameMode = "card";
let previewTimerInterval: ReturnType<typeof setInterval> | null = null;
let freeAutoSubmitTimer: ReturnType<typeof setTimeout> | null = null;

// ── DOM Helpers ──
const $ = (id: string) => document.getElementById(id)!;

function showScreen(id: string) {
  document.querySelectorAll(".screen").forEach((el) => {
    el.classList.remove("active");
  });
  $(id).classList.add("active");
}

// ── Timer Animation ──
function startTimerBar(fillId: string, durationMs: number) {
  const fill = $(fillId) as HTMLElement;
  fill.style.transition = "none";
  fill.style.width = "100%";
  fill.offsetWidth; // Force reflow
  fill.style.transition = `width ${durationMs}ms linear`;
  fill.style.width = "0%";
}

// Preview bar: fills 0% → 100% (like audio playback)
function startPreviewBar(fillId: string, durationMs: number) {
  const fill = $(fillId) as HTMLElement;
  fill.style.transition = "none";
  fill.style.width = "0%";
  fill.offsetWidth;
  fill.style.transition = `width ${durationMs}ms linear`;
  fill.style.width = "100%";
}

// ── Screen: Lobby ──
function setupLobby() {
  $("btn-create").addEventListener("click", () => {
    const name = ($("player-name") as HTMLInputElement).value.trim();
    if (!name) {
      $("lobby-error").textContent = "名前を入力してください";
      return;
    }
    playSE("click");
    send({ type: "create_room", playerName: name });
  });

  $("btn-join").addEventListener("click", () => {
    const name = ($("player-name") as HTMLInputElement).value.trim();
    const code = ($("room-code") as HTMLInputElement).value
      .trim()
      .toUpperCase();
    if (!name) {
      $("lobby-error").textContent = "名前を入力してください";
      return;
    }
    if (!code || code.length !== 4) {
      $("lobby-error").textContent = "4文字の部屋コードを入力してください";
      return;
    }
    playSE("click");
    send({ type: "join_room", roomCode: code, playerName: name });
  });
}

// ── Screen: Waiting ──
function renderPlayerList(players: { id: string; name: string }[]) {
  const list = $("player-list");
  list.innerHTML = players
    .map(
      (p) =>
        `<div class="player-item ${p.id === myPlayerId ? "me" : ""}">
          <span class="player-name">${esc(p.name)}</span>
          ${p.id === myPlayerId ? '<span class="player-badge">あなた</span>' : ""}
        </div>`
    )
    .join("");
}

function setupWaiting() {
  $("btn-start").addEventListener("click", () => {
    playSE("click");
    send({ type: "game_mode_select" });
  });
}

// ── Screen: Game Mode Select ──
function showGameModeScreen() {
  selectedGameMode = "card";
  document.querySelectorAll(".game-mode-btn").forEach((b) => {
    b.classList.remove("selected");
    if ((b as HTMLElement).dataset.mode === "card") b.classList.add("selected");
  });

  if (isHost) {
    $("btn-game-mode-next").style.display = "";
    $("game-mode-hint").style.display = "none";
    document.querySelectorAll(".game-mode-btn").forEach((b) => {
      (b as HTMLButtonElement).disabled = false;
    });
  } else {
    $("btn-game-mode-next").style.display = "none";
    $("game-mode-hint").style.display = "";
    document.querySelectorAll(".game-mode-btn").forEach((b) => {
      (b as HTMLButtonElement).disabled = true;
    });
  }

  stopAllBgm();
  playModeSelectBgm();
  showScreen("screen-game-mode");
}

function setupGameMode() {
  document.querySelectorAll(".game-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isHost) return;
      const mode = (btn as HTMLElement).dataset.mode as GameMode;
      send({ type: "game_mode_change", gameMode: mode });
    });
  });

  $("btn-game-mode-next").addEventListener("click", () => {
    playSE("click");
    send({ type: "beat_select" });
  });
}

// ── Screen: Beat Select ──
function startPreviewTimerLoop(level: 1 | 2 | 3) {
  stopPreviewTimerLoop();
  const durationMs = BEAT_DURATIONS[level];
  const runOnce = () => startPreviewBar("beat-timer-fill", durationMs);
  runOnce();
  previewTimerInterval = setInterval(runOnce, durationMs);
}

function stopPreviewTimerLoop() {
  if (previewTimerInterval) {
    clearInterval(previewTimerInterval);
    previewTimerInterval = null;
  }
}

function showBeatSelectScreen() {
  // Reset selection UI
  selectedBeatLevel = 1;
  document.querySelectorAll(".beat-level-btn").forEach((b) => {
    b.classList.remove("selected");
    if ((b as HTMLElement).dataset.level === "1") b.classList.add("selected");
  });

  if (isHost) {
    $("btn-beat-start").style.display = "";
    $("beat-select-hint").style.display = "none";
    document.querySelectorAll(".beat-level-btn").forEach((b) => {
      (b as HTMLButtonElement).disabled = false;
    });
  } else {
    $("btn-beat-start").style.display = "none";
    $("beat-select-hint").style.display = "";
    document.querySelectorAll(".beat-level-btn").forEach((b) => {
      (b as HTMLButtonElement).disabled = true;
    });
  }

  stopAllBgm();
  showScreen("screen-beat-select");
  // Auto-play Lv1 preview with timer bar
  previewBeat(1);
  startPreviewTimerLoop(1);
}

function setupBeatSelect() {
  const btns = document.querySelectorAll(".beat-level-btn");
  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isHost) return;
      const level = Number((btn as HTMLElement).dataset.level) as 1 | 2 | 3;
      send({ type: "beat_preview", beatLevel: level });
    });
  });

  $("btn-beat-start").addEventListener("click", () => {
    stopPreviewTimerLoop();
    stopPreview();
    playSE("transition");
    send({ type: "start_game", beatLevel: selectedBeatLevel });
  });
}

// ── Screen: Writing ──
function setupWriting() {
  $("btn-submit-field").addEventListener("click", () => {
    if (hasSubmittedThisRound) return;

    if (currentGameMode === "free") {
      const input = document.getElementById("free-text-input") as HTMLInputElement | null;
      const text = input?.value.trim() || "";
      if (!text || text.length > MAX_FIELD_LENGTH) return;
      send({ type: "submit_field", cardId: currentCardId, answerId: "", freeText: text });
      hasSubmittedThisRound = true;
      ($("btn-submit-field") as HTMLButtonElement).disabled = true;
      if (input) input.disabled = true;
    } else {
      if (!selectedAnswerId) return;
      send({ type: "submit_field", cardId: currentCardId, answerId: selectedAnswerId });
      hasSubmittedThisRound = true;
      ($("btn-submit-field") as HTMLButtonElement).disabled = true;
      document.querySelectorAll(".answer-card").forEach((card) => {
        (card as HTMLButtonElement).disabled = true;
      });
    }
  });
}

function renderWritingScreen(msg: Extract<ServerMessage, { type: "writing_start" }>) {
  // Clear any pending auto-submit from previous round
  if (freeAutoSubmitTimer) {
    clearTimeout(freeAutoSubmitTimer);
    freeAutoSubmitTimer = null;
  }

  currentCardId = msg.cardId;
  hasSubmittedThisRound = false;
  selectedAnswerId = "";
  currentGameMode = msg.gameMode;

  $("writing-round").textContent = String(msg.round);
  $("writing-topic").textContent = msg.topic;

  // Show previous fields (no labels, just the text)
  const prevContainer = $("writing-prev-fields");
  if (msg.previousFields.length > 0) {
    prevContainer.innerHTML = msg.previousFields
      .map(
        (text) =>
          `<div class="prev-field">
            <span class="prev-text">${esc(text)}</span>
          </div>`
      )
      .join("");
  } else {
    prevContainer.innerHTML = "";
  }

  const grid = $("answer-card-grid");

  if (msg.gameMode === "free") {
    // Free input mode
    grid.innerHTML =
      `<div class="free-input-area">
        <input type="text" id="free-text-input" placeholder="回答を入力..." maxlength="${MAX_FIELD_LENGTH}" autocomplete="off" />
        <span class="free-char-count" id="free-char-count">0 / ${MAX_FIELD_LENGTH}</span>
      </div>`;

    const input = $("free-text-input") as HTMLInputElement;
    const counter = $("free-char-count");
    input.addEventListener("input", () => {
      if (hasSubmittedThisRound) return;
      const len = input.value.length;
      counter.textContent = `${len} / ${MAX_FIELD_LENGTH}`;
      counter.classList.toggle("over", len > MAX_FIELD_LENGTH);
      ($("btn-submit-field") as HTMLButtonElement).disabled = len === 0 || len > MAX_FIELD_LENGTH;
    });
    // Auto-focus
    setTimeout(() => input.focus(), 100);

    // Auto-submit whatever is typed when time runs out
    freeAutoSubmitTimer = setTimeout(() => {
      if (hasSubmittedThisRound) return;
      const text = input.value.trim();
      if (text && text.length <= MAX_FIELD_LENGTH) {
        send({ type: "submit_field", cardId: currentCardId, answerId: "", freeText: text });
        hasSubmittedThisRound = true;
        ($("btn-submit-field") as HTMLButtonElement).disabled = true;
        input.disabled = true;
      }
    }, msg.deadline - 500);
  } else {
    // Card mode — render answer card grid
    grid.innerHTML = msg.answerOptions
      .map(
        (opt: AnswerOption, i: number) =>
          `<button class="answer-card" data-answer-id="${opt.id}" style="animation-delay:${i * 0.04}s">
            ${esc(opt.text)}
          </button>`
      )
      .join("");

    // Card selection (highlight only, submit via button)
    grid.querySelectorAll(".answer-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (hasSubmittedThisRound) return;
        const aid = (btn as HTMLElement).dataset.answerId!;
        if (selectedAnswerId === aid) {
          selectedAnswerId = "";
          btn.classList.remove("selected");
        } else {
          grid.querySelectorAll(".answer-card").forEach((c) => c.classList.remove("selected"));
          selectedAnswerId = aid;
          btn.classList.add("selected");
        }
        ($("btn-submit-field") as HTMLButtonElement).disabled = !selectedAnswerId;
      });
    });
  }

  ($("btn-submit-field") as HTMLButtonElement).disabled = true;
  $("writing-progress").textContent = "";

  startTimerBar("writing-timer-fill", msg.deadline);
  showScreen("screen-writing");
}

// ── Screen: Reveal ──
function setupReveal() {
  const reactionArea = $("reaction-area");
  reactionArea.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = (btn as HTMLElement).dataset.type as ReactionType;
      if (reactionBudget[type] <= 0) return;
      if (!currentRevealCardId) return;
      send({
        type: "send_reaction",
        cardId: currentRevealCardId,
        reactionType: type,
      });
    });
  });
}

function updateReactionButtons() {
  const types: ReactionType[] = ["kusa", "warota", "kusawarota"];
  for (const t of types) {
    const remaining = reactionBudget[t];
    $(`remaining-${t}`).textContent = String(remaining);
    const btn = document.querySelector(
      `.reaction-btn[data-type="${t}"]`
    ) as HTMLButtonElement;
    if (btn) {
      btn.disabled = remaining <= 0;
    }
  }
}

function showFloatingReaction(
  playerName: string,
  reactionType: ReactionType
) {
  const container = $("floating-reactions");
  const el = document.createElement("div");
  el.className = "floating-reaction";

  const labels: Record<ReactionType, string> = {
    kusa: "草",
    warota: "ワロタ",
    kusawarota: "クソワロタ",
  };

  el.innerHTML = `<span class="float-name">${esc(playerName)}</span> <span class="float-text">${labels[reactionType]}</span>`;
  // Random horizontal position
  el.style.left = `${20 + Math.random() * 60}%`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ── Screen: Results ──
function renderResults(
  msg: Extract<ServerMessage, { type: "results" }>
) {
  const list = $("results-list");
  list.innerHTML = msg.rankings
    .map(
      (r) =>
        `<div class="result-item ${r.rank === 1 ? "winner" : ""}">
          <div class="result-rank">${r.rank === 1 ? "👑" : r.rank}</div>
          <div class="result-info">
            <div class="result-topic">${esc(r.topic)}</div>
            <div class="result-fields">
              ${r.fields
                .map(
                  (text, i) =>
                    `<div class="result-field">
                      <span class="result-field-text">${esc(text)}</span>
                      <span class="result-field-author">${esc(r.authorNames[i])}</span>
                    </div>`
                )
                .join("")}
            </div>
            <div class="result-reactions">
              ${r.reactionSummary.kusa > 0 ? `<span class="reaction-count">草×${r.reactionSummary.kusa}</span>` : ""}
              ${r.reactionSummary.warota > 0 ? `<span class="reaction-count">ワロタ×${r.reactionSummary.warota}</span>` : ""}
              ${r.reactionSummary.kusawarota > 0 ? `<span class="reaction-count">クソワロタ×${r.reactionSummary.kusawarota}</span>` : ""}
            </div>
          </div>
          <div class="result-points">${r.totalPoints}pt</div>
        </div>`
    )
    .join("");

  if (isHost) {
    $("btn-back-lobby").style.display = "block";
  } else {
    $("btn-back-lobby").style.display = "none";
  }
}

// ── Message Handler ──
function onMessage(msg: ServerMessage) {
  console.log("[game] received:", msg.type, msg);
  switch (msg.type) {
    case "error":
      if (document.querySelector("#screen-lobby.active")) {
        $("lobby-error").textContent = msg.message;
      } else {
        console.warn("[game] error from server:", msg.message);
      }
      break;

    case "room_created":
      myPlayerId = msg.playerId;
      myRoomCode = msg.roomCode;
      isHost = true;
      $("display-room-code").textContent = msg.roomCode;
      $("btn-start").style.display = "block";
      $("waiting-hint").textContent = "プレイヤーを待っています...";
      renderPlayerList([
        {
          id: myPlayerId,
          name: ($("player-name") as HTMLInputElement).value.trim(),
        },
      ]);
      stopAllBgm();
      playWaitingBgm();
      playSE("transition");
      showScreen("screen-waiting");
      break;

    case "joined_room":
      myPlayerId = msg.playerId;
      myRoomCode = msg.roomCode;
      isHost = msg.hostId === myPlayerId;
      $("display-room-code").textContent = msg.roomCode;
      if (isHost) {
        $("btn-start").style.display = "block";
        $("waiting-hint").textContent = "プレイヤーを待っています...";
      } else {
        $("btn-start").style.display = "none";
        $("waiting-hint").textContent =
          "ホストがゲームを開始するのを待っています...";
      }
      renderPlayerList(msg.players);
      stopAllBgm();
      playWaitingBgm();
      playSE("transition");
      showScreen("screen-waiting");
      break;

    case "player_joined":
      renderPlayerList(msg.players);
      playSE("join");
      break;

    case "player_left":
      renderPlayerList(msg.players);
      break;

    case "game_mode_select_start":
      showGameModeScreen();
      break;

    case "game_mode_change": {
      const gm = msg.gameMode;
      selectedGameMode = gm;
      document.querySelectorAll(".game-mode-btn").forEach((b) => {
        b.classList.remove("selected");
        if ((b as HTMLElement).dataset.mode === gm) b.classList.add("selected");
      });
      break;
    }

    case "beat_select_start":
      showBeatSelectScreen();
      break;

    case "beat_preview": {
      const level = msg.beatLevel;
      selectedBeatLevel = level;
      document.querySelectorAll(".beat-level-btn").forEach((b) => {
        b.classList.remove("selected");
        if (Number((b as HTMLElement).dataset.level) === level) b.classList.add("selected");
      });
      previewBeat(level);
      startPreviewTimerLoop(level);
      break;
    }

    case "countdown": {
      // Stop preview on first countdown tick
      if (msg.count === 3) {
        stopPreviewTimerLoop();
        stopPreview();
      }
      const overlay = $("countdown-overlay");
      const num = $("countdown-number");
      num.textContent = String(msg.count);
      // Re-trigger animation
      num.style.animation = "none";
      num.offsetWidth;
      num.style.animation = "";
      overlay.style.display = "flex";
      break;
    }

    case "writing_start": {
      // Hide countdown
      $("countdown-overlay").style.display = "none";
      // Reset reaction budget at start of game (round 1)
      if (msg.round === 1) {
        reactionBudget = { kusa: 3, warota: 2, kusawarota: 1 };
      }
      // Derive beat level from deadline for guests
      if (msg.deadline <= 4_000) selectedBeatLevel = 3;
      else if (msg.deadline <= 6_000) selectedBeatLevel = 2;
      else selectedBeatLevel = 1;
      stopPreviewTimerLoop();
      stopAllBgm();
      playWritingBeat(selectedBeatLevel);
      renderWritingScreen(msg);
      break;
    }

    case "field_submitted":
      $("writing-progress").textContent =
        `${msg.submittedCount} / ${msg.totalCount} 人が提出`;
      break;

    case "reveal_card_start": {
      stopWritingBeat();
      currentRevealCardId = `card-${msg.cardIndex}`;

      $("reveal-card-info").textContent =
        `${msg.cardIndex + 1} / ${msg.totalCards}`;
      $("reveal-topic").textContent = msg.topic;
      // One row per person, hidden until reveal_field arrives
      const names = msg.authorNames || ["???", "???", "???"];
      $("reveal-fields").innerHTML = names
        .map(
          (_name: string, i: number) =>
            `<div class="reveal-field-row hidden" id="reveal-field-${i}">
              <span class="reveal-field-text"></span>
              <span class="reveal-field-author"></span>
            </div>`
        )
        .join("");

      $("reaction-area").style.display = "none";
      showScreen("screen-reveal");
      // Show topic text first, then speak after a brief pause
      setTimeout(() => speakTopic(msg.topic), 600);
      break;
    }

    case "reveal_field": {
      const row = $(`reveal-field-${msg.fieldIndex}`);
      if (row) {
        row.classList.remove("hidden");
        row.classList.add("field-pop");
        const textEl = row.querySelector(".reveal-field-text") as HTMLElement;
        const authorEl = row.querySelector(
          ".reveal-field-author"
        ) as HTMLElement;
        textEl.textContent = msg.text;
        authorEl.textContent = msg.authorName;
        speakField(msg.text);
      }
      break;
    }

    case "reveal_card_done":
      // Show reaction buttons during reaction window
      $("reaction-area").style.display = "flex";
      updateReactionButtons();
      break;

    case "reaction": {
      // Update own budget if it was us
      if (msg.playerId === myPlayerId) {
        reactionBudget[msg.reactionType]--;
        updateReactionButtons();
      }
      // Show floating reaction
      showFloatingReaction(msg.playerName, msg.reactionType);
      break;
    }

    case "results":
      renderResults(msg);
      showScreen("screen-results");
      break;
  }
}

// ── Utility ──
function esc(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ── Init ──
function init() {
  setupLobby();
  setupWaiting();
  setupGameMode();
  setupBeatSelect();
  setupWriting();
  setupReveal();

  $("btn-back-lobby").addEventListener("click", () => {
    stopAllBgm();
    playLobbyBgm();
    showScreen("screen-lobby");
    ($("player-name") as HTMLInputElement).value = "";
    ($("room-code") as HTMLInputElement).value = "";
    $("lobby-error").textContent = "";
  });

  // Show audio modal on page load
  $("audio-modal").style.display = "flex";

  $("btn-audio-ok").addEventListener("click", async () => {
    $("audio-modal").style.display = "none";
    audioNotified = true;
    await initAudio();
    playLobbyBgm();
  });

  connect(onMessage);
}

init();
