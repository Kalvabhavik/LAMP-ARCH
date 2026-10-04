"use client";

import { useEffect, useRef, useState } from "react";
import { COMPANIES } from "@/content/quest/companies";
import { MILESTONE } from "@/lib/game/progression";
import { isTypingTarget, playerState } from "@/lib/world/runtime";
import { isMuted, toggleMuted } from "@/lib/audio/sfx";
import { dismissAchievement, useQuestStore } from "@/stores/quest-store";

export function PlayerCard() {
  const state = useQuestStore((s) => s.state);
  if (!state) return null;
  const { player, quest } = state;
  const female = player.gender === "female";
  return (
    <div className="pointer-events-auto mb-2 flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-slate-950/90 px-3.5 py-2.5 shadow-lg shadow-cyan-400/10 backdrop-blur-md">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold ${
          female ? "border-fuchsia-300/60 bg-fuchsia-500/20 text-fuchsia-200" : "border-cyan-300/60 bg-cyan-500/20 text-cyan-200"
        }`}
      >
        {player.name.slice(0, 1).toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-bold text-slate-100">{player.name}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
          Level {quest.level} · {quest.levelName}
        </p>
      </div>
      <div className="ml-3 text-right">
        <p className="text-sm font-bold text-amber-300">{player.score}</p>
        <p className="text-[9px] uppercase tracking-widest text-slate-500">score</p>
      </div>
    </div>
  );
}

export function ObjectiveBanner() {
  const objective = useQuestStore((s) => s.state?.quest.currentObjective);
  const [pulseKey, setPulseKey] = useState(0);
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (objective && objective !== prev.current) {
      prev.current = objective;
      setPulseKey((k) => k + 1);
    }
  }, [objective]);
  if (!objective) return null;
  return (
    <div
      key={pulseKey}
      className="pointer-events-none animate-[objpulse_1.6s_ease-out] rounded-full border border-cyan-400/30 bg-slate-950/85 px-5 py-1.5 text-xs font-semibold text-cyan-200 shadow-lg backdrop-blur-md"
    >
      ◈ {objective}
      <style>{`@keyframes objpulse { 0%{box-shadow:0 0 0 0 rgba(34,211,238,.6)} 100%{box-shadow:0 0 0 18px rgba(34,211,238,0)} }`}</style>
    </div>
  );
}

export function MissionTracker() {
  const state = useQuestStore((s) => s.state);
  const openOverlay = useQuestStore((s) => s.openOverlay);
  const [open, setOpen] = useState(true);
  if (!state) return null;
  const items = state.quest.trackerItems;
  const done = items.filter((i) => i.status === "done").length;
  const milestones = new Set(state.milestones);
  const gameDone = milestones.has(MILESTONE.gameCompleted);
  // CTA follows the active mission: an accepted-but-undocumented mission (latest first).
  const activeMission = gameDone
    ? null
    : milestones.has(MILESTONE.missionAccepted("NC-001")) && !milestones.has(MILESTONE.missionDocumented("NC-001"))
      ? "NC-001"
      : milestones.has(MILESTONE.missionAccepted("BF-001")) && !milestones.has(MILESTONE.missionDocumented("BF-001"))
        ? "BF-001"
        : null;
  const nextHint =
    !gameDone && !activeMission
      ? milestones.has(MILESTONE.companyCompleted("byteforge"))
        ? "Talk to Priya Nair at NexaCore (east)"
        : null
      : null;

  return (
    <div className="pointer-events-auto w-64 rounded-xl border border-white/10 bg-slate-950/90 shadow-lg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300"
      >
        Mission tracker <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3.5 pb-3">
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${(done / items.length) * 100}%` }}
            />
          </div>
          <ul className="space-y-0.5">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-[11px]">
                <span className={item.status === "done" ? "text-emerald-400" : item.status === "current" ? "text-cyan-300" : "text-slate-600"}>
                  {item.status === "done" ? (
                    "✓"
                  ) : item.status === "current" ? (
                    "●"
                  ) : (
                    <svg viewBox="0 0 10 12" className="inline h-3 w-3 fill-current" aria-hidden="true">
                      <rect x="1" y="5" width="8" height="6" rx="1" />
                      <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  )}
                </span>
                <span className={item.status === "locked" ? "text-slate-600" : "text-slate-300"}>{item.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {COMPANIES.map((c) => {
              const unlocked = state.quest.unlockedCompanies.includes(c.id);
              const completed = milestones.has(MILESTONE.companyCompleted(c.id));
              return (
                <span
                  key={c.id}
                  className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    borderColor: completed ? "#34d39966" : unlocked ? `${c.color}66` : "#334155",
                    color: completed ? "#34d399" : unlocked ? c.color : "#64748b",
                    background: completed ? "#34d39911" : "transparent",
                  }}
                >
                  {c.name.split(" ")[0]}: {completed ? "Completed" : unlocked ? "Open" : "Locked"}
                </span>
              );
            })}
          </div>
          {activeMission && (
            <button
              type="button"
              onClick={() => openOverlay("briefing", { missionId: activeMission })}
              className="mt-2.5 w-full rounded-lg bg-cyan-500/20 py-1.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/30"
            >
              Open mission {activeMission} (J)
            </button>
          )}
          {nextHint && <p className="mt-2.5 text-[11px] text-slate-400">Next: {nextHint}</p>}
        </div>
      )}
    </div>
  );
}

export function ToastStack() {
  const toasts = useQuestStore((s) => s.toasts);
  const dismissToast = useQuestStore((s) => s.dismissToast);
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) => setTimeout(() => dismissToast(t.id), 4500));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismissToast]);
  return (
    <div className="pointer-events-none absolute bottom-24 right-4 z-50 flex w-72 flex-col gap-2">
      {toasts.slice(-3).map((toast) => (
        <div
          key={toast.id}
          className={`rounded-xl border px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md ${
            toast.kind === "score"
              ? "border-amber-400/40 bg-slate-950/95 text-amber-200"
              : toast.kind === "error"
                ? "border-red-400/40 bg-slate-950/95 text-red-300"
                : toast.kind === "milestone"
                  ? "border-cyan-400/40 bg-slate-950/95 text-cyan-200"
                  : "border-slate-600 bg-slate-950/95 text-slate-200"
          }`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

export function AchievementPopup() {
  const achievement = useQuestStore((s) => s.achievement);
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(dismissAchievement, 6000);
    return () => clearTimeout(t);
  }, [achievement]);
  if (!achievement) return null;
  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-50 w-72 animate-[slidein_.4s_ease-out] rounded-2xl border border-amber-300/50 bg-slate-950/95 p-4 shadow-2xl shadow-amber-500/20">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-xl">★</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">Achievement unlocked</p>
          <p className="text-sm font-bold text-slate-100">{achievement.name}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">{achievement.description}</p>
      <style>{`@keyframes slidein { from{transform:translateX(30px);opacity:0} to{transform:translateX(0);opacity:1} }`}</style>
    </div>
  );
}

export function HudButtons() {
  const openOverlay = useQuestStore((s) => s.openOverlay);
  const state = useQuestStore((s) => s.state);
  const [muted, setMutedState] = useState(() => isMuted());

  // J opens the active mission briefing.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== "KeyJ" || isTypingTarget(e.target)) return;
      const s = useQuestStore.getState();
      if (s.overlay !== "none") {
        if (s.overlay === "briefing") s.closeOverlay();
        return;
      }
      const m = new Set(s.state?.milestones ?? []);
      const missionId = m.has(MILESTONE.missionAccepted("NC-001")) && !m.has(MILESTONE.missionDocumented("NC-001"))
        ? "NC-001"
        : m.has(MILESTONE.missionAccepted("BF-001")) && !m.has(MILESTONE.missionDocumented("BF-001"))
          ? "BF-001"
          : null;
      if (missionId) s.openOverlay("briefing", { missionId });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Dev-only debug hook.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { lampQuestDebug?: unknown }).lampQuestDebug = {
      teleport(x: number, z: number) {
        playerState.teleport = { x, z };
      },
      position: () => ({ x: playerState.position.x, z: playerState.position.z }),
      state: () => useQuestStore.getState(),
    };
    return () => {
      delete (window as unknown as { lampQuestDebug?: unknown }).lampQuestDebug;
    };
  }, []);

  return (
    <div className="pointer-events-auto flex gap-2">
      <button
        type="button"
        onClick={() => setMutedState(toggleMuted())}
        title={muted ? "Unmute" : "Mute"}
        className="rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-sm text-slate-300 backdrop-blur-md hover:bg-slate-900"
      >
        <svg viewBox="0 0 20 16" className="inline h-4 w-4 fill-current" aria-hidden="true">
          <path d="M2 5h4l5-4v14l-5-4H2z" />
          {muted ? (
            <path d="M13 5l6 6m0-6l-6 6" stroke="currentColor" strokeWidth="1.6" fill="none" />
          ) : (
            <path d="M14 4a4.5 4.5 0 0 1 0 8M16 2a7.5 7.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.4" fill="none" />
          )}
        </svg>
      </button>
      <button
        type="button"
        onClick={() => openOverlay("hub_intro")}
        disabled={!state}
        title="World guide"
        className="rounded-xl border border-emerald-400/30 bg-slate-950/90 px-3 py-2 text-sm font-bold text-emerald-300 backdrop-blur-md hover:bg-slate-900 disabled:opacity-40"
      >
        ?
      </button>
    </div>
  );
}
