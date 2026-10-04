"use client";

import { STATIONS } from "@/content/stations";
import { STATION_SITES } from "@/content/quest/station-sites";
import { useGameStore } from "@/stores/game-store";
import { useQuestStore } from "@/stores/quest-store";

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

export function MapStrip() {
  const panel = useGameStore((state) => state.panel);
  const setPanel = useGameStore((state) => state.setPanel);
  const openOverlay = useQuestStore((state) => state.openOverlay);

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 p-2.5 backdrop-blur-md shadow-lg">
      {STATIONS.map((station) => (
        <button
          key={station.id}
          type="button"
          onClick={() => openOverlay("site", { siteId: station.id })}
          className="relative rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors hover:bg-white/10"
          style={{
            background: `${station.themeColor}22`,
            color: station.themeColor,
            border: `1px solid ${station.themeColor}44`,
          }}
        >
          {STATION_SITES[station.id].title}
        </button>
      ))}
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
