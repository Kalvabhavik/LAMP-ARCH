"use client";

import { create } from "zustand";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { api, uploadWithProgress, ApiError } from "@/lib/api/client";
import type { GameEvent, GameState } from "@/lib/game/state";
import { milestoneLabel } from "@/lib/game/progression";
import { playSfx } from "@/lib/audio/sfx";

export type QuestStatus = "idle" | "loading" | "needs_registration" | "ready" | "not_configured" | "error";
export type OverlayId = "none" | "dialogue" | "briefing" | "magic_box" | "hub_intro" | "info" | "celebration" | "completion";

export type Toast = { id: number; kind: "score" | "milestone" | "error" | "info"; text: string };
export type AchievementPop = { key: string; name: string; description: string };

let toastCounter = 0;
let trainingTimer: ReturnType<typeof setTimeout> | null = null;

type QuestStore = {
  status: QuestStatus;
  error: string | null;
  state: GameState | null;
  overlay: OverlayId;
  overlayData: unknown;
  toasts: Toast[];
  achievement: AchievementPop | null;
  isNewPlayer: boolean;

  load: () => Promise<void>;
  register: (name: string, gender: "male" | "female") => Promise<boolean>;
  postMilestone: (key: string) => Promise<void>;
  setLocation: (location: string) => Promise<void>;
  unlockHint: (missionId: string, hintIndex: number) => Promise<void>;
  acceptMission: (missionId: string) => Promise<void>;
  submitSolution: (missionId: string, file: File, onProgress?: (f: number) => void) => Promise<unknown>;
  submitProcedure: (missionId: string, payload: { text: string; format: "text" | "markdown" } | { file: File }) => Promise<unknown>;
  openOverlay: (overlay: OverlayId, data?: unknown) => void;
  closeOverlay: () => void;
  pushToast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
  syncTraining: (training: { xp: number; completedMissionIds: string[]; collectedCrystalIds: string[] }) => void;
  signOut: () => Promise<void>;
};

function applyEvents(
  set: (p: Partial<QuestStore> | ((s: QuestStore) => Partial<QuestStore>)) => void,
  events: GameEvent[] | undefined,
) {
  for (const event of events ?? []) {
    if (event.type === "score") {
      const text = `${event.delta > 0 ? "+" : ""}${event.delta} ${event.label}`;
      set((s) => ({ toasts: [...s.toasts, { id: ++toastCounter, kind: "score", text }] }));
      playSfx(event.delta > 0 ? "success" : "fail");
    } else if (event.type === "milestone") {
      set((s) => ({
        toasts: [...s.toasts, { id: ++toastCounter, kind: "milestone", text: milestoneLabel(event.key) }],
      }));
    } else if (event.type === "achievement") {
      set({ achievement: { key: event.key, name: event.name, description: event.description } });
      playSfx("achievement");
    }
  }
}

export const useQuestStore = create<QuestStore>((set, get) => ({
  status: "idle",
  error: null,
  state: null,
  overlay: "none",
  overlayData: null,
  toasts: [],
  achievement: null,
  isNewPlayer: false,

  load: async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      set({ status: "not_configured", error: "Supabase is not configured." });
      return;
    }
    set({ status: "loading", error: null });
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
      }
      const res = await api("/player");
      const wasReady = get().state !== null;
      set({ state: res.state ?? null, status: "ready" });
      if (!wasReady && res.state) {
        const name = res.state.player.name;
        set((s) => ({
          toasts: [
            ...s.toasts,
            { id: ++toastCounter, kind: "info", text: `Welcome back, ${name}.` },
          ],
        }));
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "PLAYER_NOT_FOUND") {
        set({ status: "needs_registration", state: null });
      } else if (err instanceof ApiError && err.code === "SUPABASE_NOT_CONFIGURED") {
        set({ status: "not_configured", error: err.message });
      } else {
        set({ status: "error", error: err instanceof Error ? err.message : "Failed to load." });
      }
    }
  },

  register: async (name, gender) => {
    const res = await api("/player", { method: "POST", body: { name, gender } });
    set({
      state: res.state ?? null,
      status: "ready",
      isNewPlayer: true,
      toasts: [
        ...get().toasts,
        { id: ++toastCounter, kind: "info", text: `Welcome to the world, ${name}.` },
      ],
    });
    applyEvents(set, res.events);
    return true;
  },

  postMilestone: async (key) => {
    const current = get().state;
    if (current?.milestones.includes(key)) return;
    try {
      const res = await api("/progress", { method: "POST", body: { type: "milestone", milestone: key } });
      if (res.state) set({ state: res.state });
      applyEvents(set, res.events);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "MILESTONE_LOCKED" || err.code === "UNKNOWN_MILESTONE")) return;
      get().pushToast("error", err instanceof Error ? err.message : "Failed to save progress.");
    }
  },

  setLocation: async (location) => {
    const current = get().state;
    if (!current || current.player.currentLocation === location) return;
    try {
      const res = await api("/progress", { method: "POST", body: { type: "location", location } });
      if (res.state) set({ state: res.state });
      applyEvents(set, res.events);
    } catch {
      /* location is best-effort */
    }
  },

  unlockHint: async (missionId, hintIndex) => {
    const res = await api("/progress", { method: "POST", body: { type: "hint", missionId, hintIndex } });
    if (res.state) set({ state: res.state });
    applyEvents(set, res.events);
  },

  acceptMission: async (missionId) => {
    const res = await api(`/missions/${missionId}/accept`, { method: "POST" });
    if (res.state) set({ state: res.state });
    applyEvents(set, res.events);
  },

  submitSolution: async (missionId, file, onProgress) => {
    const form = new FormData();
    form.set("file", file);
    const res = await uploadWithProgress(`/missions/${missionId}/submissions`, form, onProgress);
    if (res.state) set({ state: res.state });
    applyEvents(set, res.events);
    return res.result;
  },

  submitProcedure: async (missionId, payload) => {
    const form = new FormData();
    if ("file" in payload) form.set("file", payload.file);
    else {
      form.set("text", payload.text);
      form.set("format", payload.format);
    }
    const res = await uploadWithProgress(`/missions/${missionId}/procedure`, form);
    if (res.state) set({ state: res.state });
    applyEvents(set, res.events);
    return res.review;
  },

  openOverlay: (overlay, data) => set({ overlay, overlayData: data ?? null }),
  closeOverlay: () => set({ overlay: "none", overlayData: null }),

  pushToast: (kind, text) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++toastCounter, kind, text }] })),

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  syncTraining: (training) => {
    if (trainingTimer) clearTimeout(trainingTimer);
    trainingTimer = setTimeout(() => {
      if (get().status !== "ready") return;
      void api("/progress", { method: "POST", body: { type: "training", training } }).catch(() => undefined);
    }, 2000);
  },

  signOut: async () => {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    set({ state: null, status: "idle", overlay: "none", toasts: [], achievement: null, isNewPlayer: false });
  },
}));

/** Dismiss an achievement popup after it has been shown. */
export function dismissAchievement() {
  useQuestStore.setState({ achievement: null });
}
