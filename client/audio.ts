import * as Tone from "tone";

// ── State ──
let audioInitialized = false;
let currentBgm: "lobby" | "waiting" | "modeselect" | null = null;
let writingBeatPlaying = false;
let previewPlaying = false;

// ── Instruments (lazy-init) ──
// Lobby
let lobbyMelodySynth: Tone.Synth;
let lobbyBassSynth: Tone.MonoSynth;
let lobbyHihat: Tone.NoiseSynth;
let lobbyKick: Tone.MembraneSynth;
let lobbySnare: Tone.NoiseSynth;
let lobbyMelodySeq: Tone.Sequence;
let lobbyBassSeq: Tone.Sequence;
let lobbyDrumSeq: Tone.Sequence;

// Waiting
let waitingPadSynth: Tone.PolySynth;
let waitingArpSynth: Tone.Synth;
let waitingChordSeq: Tone.Sequence;
let waitingArpSeq: Tone.Sequence;

// Mode Select
let modeBus: Tone.Volume;
let modeBassSynth: Tone.MonoSynth;
let modePadSynth: Tone.PolySynth;
let modePercSynth: Tone.MembraneSynth;
let modeHihat: Tone.NoiseSynth;
let modeMelodySynth: Tone.Synth;
let modeBassSeq: Tone.Sequence;
let modePadSeq: Tone.Sequence;
let modeDrumSeq: Tone.Sequence;
let modeMelodySeq: Tone.Sequence;

// Writing Beat
let beatKick: Tone.MembraneSynth;
let beatSnare: Tone.NoiseSynth;
let beatHihat: Tone.NoiseSynth;
let beatScratch: Tone.NoiseSynth;
let beatScratchFilter: Tone.Filter;
let writingBeatSeq: Tone.Sequence | null = null;

// SE
let clickSynth: Tone.Synth;
let joinSynth: Tone.Synth;
let transitionSynth: Tone.NoiseSynth;

// ── Init ──
export async function initAudio(): Promise<void> {
  if (audioInitialized) return;
  await Tone.start();
  audioInitialized = true;
  setupInstruments();
}

export function isAudioReady(): boolean {
  return audioInitialized;
}

function setupInstruments() {
  // ══════════════════════════════════════
  // Lobby BGM — groovy pop, BPM 148
  // ボッボッボッ bass + pop melody + drums
  // ══════════════════════════════════════

  lobbyMelodySynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.005, decay: 0.12, sustain: 0.15, release: 0.08 },
    volume: -12,
  }).toDestination();

  // Punchy fat bass — the "ボッボッボッ" sound
  lobbyBassSynth = new Tone.MonoSynth({
    oscillator: { type: "fatsawtooth", count: 3, spread: 15 },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0.1, release: 0.08 },
    filterEnvelope: {
      attack: 0.005, decay: 0.12, sustain: 0.1, release: 0.08,
      baseFrequency: 80, octaves: 4,
    },
    volume: -4,
  }).toDestination();

  // Kick drum
  lobbyKick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    volume: -8,
  }).toDestination();

  // Snare / hihat combo
  lobbyHihat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    volume: -20,
  }).toDestination();

  lobbySnare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    volume: -14,
  }).toDestination();

  // ── Lobby melody: bouncy swing pop ──
  const lobbyMelody = [
    "E5", null, "G5", "A5", null, "G5", "E5", "D5",
    "C5", null, "D5", "E5", null, "G5", "A5", null,
    "G5", "E5", "C5", "D5", null, "E5", null, "D5",
    "C5", null, "E5", "G5", "A5", null, "C6", null,
    // Phrase 2
    "A5", null, "G5", "E5", null, "D5", "E5", "G5",
    "A5", null, "C6", "A5", null, "G5", "E5", null,
    "F5", "E5", "D5", "C5", null, "D5", null, "E5",
    "G5", null, "A5", "G5", "E5", null, "C5", null,
  ];

  lobbyMelodySeq = new Tone.Sequence(
    (time, note) => {
      if (note) lobbyMelodySynth.triggerAttackRelease(note, "16n", time);
    },
    lobbyMelody,
    "8n"
  );

  // ── Lobby bass: ボッボッボッボッ swing groove ──
  const lobbyBass = [
    "C1", null, "C1", "C1", null, "C1", null, "C1",
    "F1", null, "F1", "F1", null, "F1", null, "F1",
    "G1", null, "G1", "G1", null, "E1", null, "E1",
    "F1", null, "F1", "G1", null, "G1", null, "G1",
    // 2
    "C1", null, "C1", "C1", null, "C1", null, "E1",
    "F1", null, "F1", "F1", null, "A1", null, "G1",
    "G1", null, "G1", "G1", null, "E1", null, "E1",
    "F1", null, "G1", "G1", null, "C1", null, "C1",
  ];

  lobbyBassSeq = new Tone.Sequence(
    (time, note) => {
      if (note) lobbyBassSynth.triggerAttackRelease(note, "16n", time);
    },
    lobbyBass,
    "8n"
  );

  // ── Lobby drums: swing feel ──
  // K=kick, S=snare, H=hihat, null=rest
  type DrumHit = "K" | "S" | "H" | "KH" | "SH" | null;
  const lobbyDrumPattern: DrumHit[] = [
    "KH", "H", "H", "SH", "H", "H", "KH", "H",
    "H", "KH", "H", "SH", "H", "H", "KH", "H",
    "KH", "H", "H", "SH", "H", "KH", "H", "H",
    "KH", "H", "H", "SH", "H", "H", "KH", "SH",
  ];

  lobbyDrumSeq = new Tone.Sequence(
    (time, hit) => {
      if (!hit) return;
      if (hit.includes("K")) lobbyKick.triggerAttackRelease("C1", "8n", time);
      if (hit.includes("S")) lobbySnare.triggerAttackRelease("16n", time);
      if (hit.includes("H")) lobbyHihat.triggerAttackRelease("32n", time);
    },
    lobbyDrumPattern,
    "8n"
  );

  // ══════════════════════════════════════
  // Waiting BGM — waku-waku, BPM 120
  // ══════════════════════════════════════

  waitingPadSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.3, decay: 0.4, sustain: 0.6, release: 0.8 },
    volume: -18,
  }).toDestination();

  waitingArpSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 },
    volume: -16,
  }).toDestination();

  const waitingChords = [
    ["C4", "E4", "G4"],
    ["F4", "A4", "C5"],
    ["G4", "B4", "D5"],
    ["A3", "C4", "E4"],
    ["F4", "A4", "C5"],
    ["G4", "B4", "D5"],
    ["E4", "G4", "B4"],
    ["G4", "B4", "D5"],
  ];

  waitingChordSeq = new Tone.Sequence(
    (time, chord) => {
      if (chord) waitingPadSynth.triggerAttackRelease(chord as string[], "2n", time);
    },
    waitingChords,
    "2n"
  );

  const waitingArp = [
    "C5", "E5", "G5", "C6",
    "A4", "C5", "E5", "A5",
    "F4", "A4", "C5", "F5",
    "G4", "B4", "D5", "G5",
    "C5", "E5", "G5", "E5",
    "F4", "A4", "C5", "A4",
    "G4", "B4", "D5", "B4",
    "G4", "A4", "B4", "D5",
  ];

  waitingArpSeq = new Tone.Sequence(
    (time, note) => {
      if (note) waitingArpSynth.triggerAttackRelease(note, "16n", time);
    },
    waitingArp,
    "8n"
  );

  // ══════════════════════════════════════
  // Mode Select BGM — デンデンデデデン, BPM 108
  // Rhythmic, calm but pop
  // ══════════════════════════════════════

  // Audio bus — instant mute on stop
  modeBus = new Tone.Volume(0).toDestination();

  // Plucky warm bass — the "デン" sound
  modeBassSynth = new Tone.MonoSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.25, sustain: 0.05, release: 0.12 },
    filterEnvelope: {
      attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.1,
      baseFrequency: 120, octaves: 3,
    },
    volume: -4,
  }).connect(modeBus);

  // Soft pad for warmth
  modePadSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.4, decay: 0.5, sustain: 0.5, release: 1.0 },
    volume: -22,
  }).connect(modeBus);

  // Soft kick for rhythm
  modePercSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 4,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.08 },
    volume: -10,
  }).connect(modeBus);

  // Light hihat taps
  modeHihat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: -24,
  }).connect(modeBus);

  // Cute melody synth
  modeMelodySynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.18, sustain: 0.1, release: 0.15 },
    volume: -14,
  }).connect(modeBus);

  // Bass pattern: "デンデンデデデン" groove — D minor feel
  // Den . Den . DeDe Den .  (eighth notes)
  const modeBass = [
    "D2", null, "D2", null, "D2", "F2", "A2", null,
    "G2", null, "G2", null, "G2", "A2", "Bb2", null,
    "F2", null, "F2", null, "F2", "G2", "A2", null,
    "A2", null, "G2", null, "F2", "E2", "D2", null,
  ];

  modeBassSeq = new Tone.Sequence(
    (time, note) => {
      if (note) modeBassSynth.triggerAttackRelease(note, "16n", time);
    },
    modeBass,
    "8n"
  );

  // Pad: gentle chord changes
  const modePadChords = [
    ["D4", "F4", "A4"],
    ["Bb3", "D4", "F4"],
    ["C4", "E4", "G4"],
    ["A3", "C#4", "E4"],
  ];

  modePadSeq = new Tone.Sequence(
    (time, chord) => {
      if (chord) modePadSynth.triggerAttackRelease(chord as string[], "1n", time);
    },
    modePadChords,
    "1n"
  );

  // Drums: kick on "デン" beats + steady hihat
  // K=kick, H=hihat, KH=both
  type ModeHit = "K" | "H" | "KH" | null;
  const modeDrumPattern: ModeHit[] = [
    "KH", "H", "KH", "H", "KH", "KH", "KH", "H",
    "KH", "H", "KH", "H", "KH", "KH", "KH", "H",
    "KH", "H", "KH", "H", "KH", "KH", "KH", "H",
    "KH", "H", "KH", "H", "KH", "KH", "KH", "H",
  ];

  modeDrumSeq = new Tone.Sequence(
    (time, hit) => {
      if (!hit) return;
      if (hit.includes("K")) modePercSynth.triggerAttackRelease("C1", "8n", time);
      if (hit.includes("H")) modeHihat.triggerAttackRelease("32n", time);
    },
    modeDrumPattern,
    "8n"
  );

  // Melody: playful little phrase
  const modeMelody = [
    "D5", null, "F5", null, "A5", "G5", "F5", null,
    null, null, "Bb5", null, "A5", null, "G5", null,
    "F5", null, "E5", null, "D5", "E5", "F5", null,
    null, null, "A5", null, "G5", "F5", "E5", null,
  ];

  modeMelodySeq = new Tone.Sequence(
    (time, note) => {
      if (note) modeMelodySynth.triggerAttackRelease(note, "16n", time);
    },
    modeMelody,
    "8n"
  );

  // ══════════════════════════════════════
  // Writing Beat — kick + snare + hihat + scratch
  // 3 unique patterns, loop = time limit
  // ══════════════════════════════════════

  beatKick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 5,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.08 },
    volume: -6,
  }).toDestination();

  beatSnare = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.04 },
    volume: -12,
  }).toDestination();

  beatHihat = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    volume: -20,
  }).toDestination();

  // Scratch: noise through bandpass filter, swept for vinyl feel
  beatScratchFilter = new Tone.Filter({
    frequency: 1500,
    type: "bandpass",
    Q: 6,
  }).toDestination();

  beatScratch = new Tone.NoiseSynth({
    noise: { type: "brown" },
    envelope: { attack: 0.005, decay: 0.06, sustain: 0, release: 0.02 },
    volume: -2,
  }).connect(beatScratchFilter);

  // ══════════════════════════════════════
  // SE Instruments
  // ══════════════════════════════════════

  clickSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    volume: -10,
  }).toDestination();

  joinSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.2 },
    volume: -10,
  }).toDestination();

  transitionSynth = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.05 },
    volume: -12,
  }).toDestination();
}

// ── BGM Control ──
export function playLobbyBgm() {
  if (!audioInitialized) return;
  if (currentBgm) stopAllBgm();

  const t = Tone.getTransport();
  t.bpm.value = 145;
  t.swing = 0.55;
  t.swingSubdivision = "8n";
  t.position = 0;
  lobbyMelodySeq.start(0);
  lobbyBassSeq.start(0);
  lobbyDrumSeq.start(0);
  t.start();

  currentBgm = "lobby";
}

export function playWaitingBgm() {
  if (!audioInitialized) return;
  if (currentBgm) stopAllBgm();

  const t = Tone.getTransport();
  t.bpm.value = 120;
  t.swing = 0;
  t.position = 0;
  waitingChordSeq.start(0);
  waitingArpSeq.start(0);
  t.start();

  currentBgm = "waiting";
}

export function playModeSelectBgm() {
  if (!audioInitialized) return;
  if (currentBgm) stopAllBgm();

  modeBus.mute = false;
  const t = Tone.getTransport();
  t.bpm.value = 108;
  t.swing = 0.25;
  t.swingSubdivision = "8n";
  t.position = 0;
  modeBassSeq.start(0);
  modePadSeq.start(0);
  modeDrumSeq.start(0);
  modeMelodySeq.start(0);
  t.start();

  currentBgm = "modeselect";
}

export function stopAllBgm() {
  if (!audioInitialized) return;

  stopWritingBeat();

  if (!currentBgm) return;

  const t = Tone.getTransport();
  t.stop();
  t.position = 0;

  // Stop active sequences at time 0
  if (currentBgm === "lobby") {
    lobbyMelodySeq.stop(0);
    lobbyBassSeq.stop(0);
    lobbyDrumSeq.stop(0);
  } else if (currentBgm === "waiting") {
    waitingChordSeq.stop(0);
    waitingArpSeq.stop(0);
  } else if (currentBgm === "modeselect") {
    modeBus.mute = true;
    modeBassSeq.stop(0);
    modePadSeq.stop(0);
    modeDrumSeq.stop(0);
    modeMelodySeq.stop(0);
  }

  t.cancel();
  currentBgm = null;
}

// ── Writing Beat Patterns ──
// Each pattern = 32 steps (2 bars × 16 sixteenth-notes)
// BPM tuned so 2 bars = time limit: Lv1→60BPM=8s, Lv2→80BPM=6s, Lv3→120BPM=4s
// K=kick, S=snare, H=hihat, KH/SH=combo, SC=チェケチェケ(4hit), sc=チェケ(2hit)
type BeatHit = "K" | "S" | "H" | "KH" | "SH" | "SC" | "sc" | null;

// Lv1: Chill boom-bap (8s) — spacious groove, チェケチェケ at tail
const PATTERN_LV1: BeatHit[] = [
  // Bar 1: classic boom-bap
  "KH", null, "H",  null, "SH", null, "H",  null,
  null, "H",  "KH", null, "SH", null, "H",  null,
  // Bar 2: same groove → scratch ending
  "KH", null, "H",  null, "SH", null, "H",  null,
  null, "H",  "KH", null, "sc", null, "SC", null,
];

// Lv2: Funky breakbeat (6s) — syncopated, チェケチェケ at tail
const PATTERN_LV2: BeatHit[] = [
  // Bar 1: broken beat, off-beat kicks
  "KH", null, null, "H",  null, "SH", "H",  null,
  "K",  null, "KH", null, "SH", null, "H",  null,
  // Bar 2: driving groove → scratch ending
  null, "H",  "KH", null, "SH", null, "H",  "K",
  null, "H",  null, "KH", "sc", null, "SC", null,
];

// Lv3: Aggressive four-on-the-floor (4s) — dense, チェケチェケ at tail
const PATTERN_LV3: BeatHit[] = [
  // Bar 1: relentless kick + hihats
  "KH", "H",  "K",  "H",  "SH", "H",  "K",  "H",
  "KH", "H",  "K",  "H",  "SH", "H",  "H",  "H",
  // Bar 2: same energy → scratch ending
  "KH", "H",  "K",  "H",  "SH", "H",  "K",  "H",
  "KH", "H",  "K",  "H",  "sc", null, "SC", null,
];

const BEAT_PATTERNS: Record<1 | 2 | 3, BeatHit[]> = {
  1: PATTERN_LV1,
  2: PATTERN_LV2,
  3: PATTERN_LV3,
};

// BPM so that 2 bars of 4/4 = desired seconds
// 2 bars = 8 beats; seconds = 8 * (60/BPM)
const BEAT_BPM: Record<1 | 2 | 3, number> = { 1: 60, 2: 80, 3: 120 };

function triggerScratch(time: number, hits: number) {
  const gap = 0.065; // interval between each チェ/ケ
  for (let i = 0; i < hits; i++) {
    const t = time + i * gap;
    beatScratch.triggerAttackRelease("64n", t);
    // Alternate filter sweep direction for vinyl scratch feel
    if (i % 2 === 0) {
      beatScratchFilter.frequency.setValueAtTime(600, t);
      beatScratchFilter.frequency.linearRampToValueAtTime(4000, t + gap * 0.7);
    } else {
      beatScratchFilter.frequency.setValueAtTime(4000, t);
      beatScratchFilter.frequency.linearRampToValueAtTime(600, t + gap * 0.7);
    }
  }
}

function handleBeatHit(time: number, hit: BeatHit) {
  if (!hit) return;
  if (hit.includes("K")) beatKick.triggerAttackRelease("C1", "8n", time);
  if (hit.includes("S") && hit !== "SC" && hit !== "sc") beatSnare.triggerAttackRelease("16n", time);
  if (hit.includes("H")) beatHihat.triggerAttackRelease("32n", time);
  if (hit === "SC") triggerScratch(time, 4); // チェケチェケ
  if (hit === "sc") triggerScratch(time, 2); // チェケ
}

function createBeatSequence(level: 1 | 2 | 3): Tone.Sequence {
  const pattern = BEAT_PATTERNS[level];
  return new Tone.Sequence(
    (time, hit) => handleBeatHit(time, hit),
    pattern,
    "16n"
  );
}

export function playWritingBeat(level: 1 | 2 | 3) {
  if (!audioInitialized) return;
  if (writingBeatPlaying) stopWritingBeat();
  if (currentBgm) stopAllBgm();

  const t = Tone.getTransport();
  t.bpm.value = BEAT_BPM[level];
  t.swing = 0;
  t.position = 0;

  writingBeatSeq = createBeatSequence(level);
  writingBeatSeq.start(0);
  t.start();

  writingBeatPlaying = true;
}

export function stopWritingBeat() {
  if (!audioInitialized || !writingBeatPlaying) return;

  if (writingBeatSeq) {
    writingBeatSeq.stop(0);
    writingBeatSeq.dispose();
    writingBeatSeq = null;
  }

  if (!currentBgm) {
    const t = Tone.getTransport();
    t.stop();
    t.position = 0;
    t.cancel();
  }

  writingBeatPlaying = false;
}

export function previewBeat(level: 1 | 2 | 3) {
  if (!audioInitialized) return;
  stopPreview();
  if (currentBgm) stopAllBgm();

  const t = Tone.getTransport();
  t.bpm.value = BEAT_BPM[level];
  t.swing = 0;
  t.position = 0;

  writingBeatSeq = createBeatSequence(level);
  writingBeatSeq.start(0);
  t.start();

  previewPlaying = true;
  writingBeatPlaying = true;
}

export function stopPreview() {
  if (!audioInitialized || !previewPlaying) return;
  stopWritingBeat();
  previewPlaying = false;
}

// ── SE ──
export function playSE(name: "click" | "join" | "transition") {
  if (!audioInitialized) return;

  const now = Tone.now();
  switch (name) {
    case "click":
      clickSynth.triggerAttackRelease("C6", "32n", now);
      break;
    case "join":
      joinSynth.triggerAttackRelease("C5", "16n", now);
      joinSynth.triggerAttackRelease("E5", "16n", now + 0.08);
      joinSynth.triggerAttackRelease("G5", "16n", now + 0.16);
      break;
    case "transition":
      transitionSynth.triggerAttackRelease("8n", now);
      break;
  }
}
