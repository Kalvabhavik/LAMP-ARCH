"use client";

const MUTE_KEY = "lamp-quest-muted";

export type SfxKind = "chime" | "success" | "fail" | "achievement" | "click";

let audio: AudioContext | null = null;
let mutedCache: boolean | null = null;

export function isMuted(): boolean {
  if (mutedCache !== null) return mutedCache;
  mutedCache = typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
  return mutedCache;
}

export function setMuted(muted: boolean) {
  mutedCache = muted;
  if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return isMuted();
}

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function tone(context: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, gain = 0.08) {
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = context.currentTime + at;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(gain, t + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(context.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Synthesized sound effects — no audio assets needed. */
export function playSfx(kind: SfxKind) {
  if (isMuted()) return;
  const context = ctx();
  if (!context) return;
  switch (kind) {
    case "chime":
      tone(context, 660, 0, 0.35, "sine");
      tone(context, 990, 0.09, 0.4, "sine");
      tone(context, 1320, 0.18, 0.5, "sine", 0.05);
      break;
    case "success":
      tone(context, 523, 0, 0.15, "triangle");
      tone(context, 659, 0.1, 0.15, "triangle");
      tone(context, 784, 0.2, 0.35, "triangle");
      break;
    case "fail":
      tone(context, 220, 0, 0.25, "sawtooth", 0.05);
      tone(context, 165, 0.12, 0.35, "sawtooth", 0.05);
      break;
    case "achievement":
      tone(context, 784, 0, 0.18, "triangle");
      tone(context, 988, 0.09, 0.18, "triangle");
      tone(context, 1175, 0.18, 0.3, "triangle");
      tone(context, 1568, 0.27, 0.5, "sine", 0.05);
      break;
    case "click":
      tone(context, 880, 0, 0.06, "square", 0.03);
      break;
  }
}
