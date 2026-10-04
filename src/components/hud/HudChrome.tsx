"use client";

import { MODE_ORDER } from "@/constants/stations";
import { STATIONS, getStation } from "@/content/stations";
import { useGameStore } from "@/stores/game-store";
import type { LearningMode } from "@/types/game";

const MODE_LABEL: Record<LearningMode, string> = {
  learn: "Learn",
  practice: "Practice",
  diy: "DIY",
};

const MODE_COLORS: Record<LearningMode, { bg: string; text: string; border: string }> = {
  learn: { bg: "bg-blue-500", text: "text-blue-400", border: "border-blue-400" },
  practice: { bg: "bg-yellow-500", text: "text-yellow-400", border: "border-yellow-400" },
  diy: { bg: "bg-green-500", text: "text-green-400", border: "border-green-400" },
};

export function XpBar() {
  const xp = useGameStore((state) => state.xp);
  const level = Math.floor(xp / 100) + 1;
  const into = xp % 100;

  return (
    <div className="pointer-events-auto flex min-w-[240px] items-center gap-3 rounded-xl border border-cyan-400/30 bg-slate-950/90 px-4 py-2.5 backdrop-blur-md shadow-lg shadow-cyan-400/10">
      <div className="text-xs font-bold tracking-widest text-cyan-300">LV {level}</div>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800 shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-all duration-500 shadow-lg shadow-cyan-400/30"
          style={{ width: `${into}%` }}
        />
      </div>
      <div className="text-xs font-semibold text-cyan-300">{xp} XP</div>
    </div>
  );
}

export function ModeTabs() {
  const activeStationId = useGameStore((state) => state.activeStationId);
  const activeMode = useGameStore((state) => state.activeMode);
  const unlockedModes = useGameStore((state) => state.unlockedModes);
  const setMode = useGameStore((state) => state.setMode);
  if (!activeStationId) return null;
  const modes = unlockedModes[activeStationId] ?? [];

  return (
    <div className="flex gap-2">
      {MODE_ORDER.map((mode, index) => {
        const unlocked = modes.includes(mode);
        const active = activeMode === mode;
        const colors = MODE_COLORS[mode];
        const stepNumber = index + 1;

        return (
          <button
            key={mode}
            type="button"
            disabled={!unlocked}
            onClick={() => setMode(mode)}
            className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              active
                ? `${colors.bg} text-white shadow-lg scale-105`
                : unlocked
                  ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600"
                  : "cursor-not-allowed bg-slate-900/50 text-slate-600 border border-slate-800"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              active ? "bg-white/20" : unlocked ? "bg-slate-700" : "bg-slate-800"
            }`}>
              {stepNumber}
            </span>
            {MODE_LABEL[mode]}
            {!unlocked && <span className="text-[10px]">🔒</span>}
          </button>
        );
      })}
    </div>
  );
}

export function StationChip() {
  const activeStationId = useGameStore((state) => state.activeStationId);
  if (!activeStationId) return null;
  const station = getStation(activeStationId);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: station.themeColor }} />
      <div className="text-sm font-bold" style={{ color: station.themeColor }}>
        {station.title} Station
      </div>
    </div>
  );
}

export function MapStrip() {
  const unlockedStationIds = useGameStore((state) => state.unlockedStationIds);
  const openStation = useGameStore((state) => state.openStation);
  const panel = useGameStore((state) => state.panel);
  const setPanel = useGameStore((state) => state.setPanel);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 p-2.5 backdrop-blur-md shadow-lg">
      {STATIONS.map((station) => {
        const unlocked = unlockedStationIds.includes(station.id);
        return (
          <button
            key={station.id}
            type="button"
            disabled={!unlocked}
            onClick={() => openStation(station.id)}
            className="relative rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
            style={{
              background: unlocked ? `${station.themeColor}22` : "#0f172a",
              color: unlocked ? station.themeColor : "#64748b",
              border: unlocked ? `${station.themeColor}44` : "#1e293b",
            }}
          >
            {unlocked && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
            )}
            {station.title}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setPanel(panel === "tutor" ? "none" : "tutor")}
        className="rounded-lg bg-violet-500/20 border border-violet-400/30 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-300 hover:bg-violet-500/30 transition-all duration-300 hover:scale-105"
      >
        Tutor
      </button>
    </div>
  );
}
