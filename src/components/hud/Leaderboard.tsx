"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLeaderboard, type LeaderboardResponse, type LeaderboardRow } from "@/lib/api/client";
import { isTypingTarget } from "@/lib/world/runtime";
import { useGameStore } from "@/stores/game-store";
import { useQuestStore } from "@/stores/quest-store";

export function Leaderboard() {
  const score = useQuestStore((state) => state.state?.player.score ?? 0);
  const achievementCount = useQuestStore((state) => state.state?.achievements.length ?? 0);
  const overlay = useQuestStore((state) => state.overlay);
  const trainingXp = useGameStore((state) => state.xp);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LeaderboardResponse["leaderboard"] | null>(null);
  const [error, setError] = useState(false);
  const initialStateSeen = useRef(false);
  const initialXpSeen = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await getLeaderboard();
      setData(result.leaderboard);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 15000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (!initialStateSeen.current) {
      initialStateSeen.current = true;
      return;
    }
    void refresh();
  }, [score, achievementCount, refresh]);

  useEffect(() => {
    if (!initialXpSeen.current) {
      initialXpSeen.current = true;
      return;
    }
    const timeout = window.setTimeout(() => void refresh(), 2500);
    return () => window.clearTimeout(timeout);
  }, [trainingXp, refresh]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "l" ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        overlay !== "none" ||
        isTypingTarget(event.target)
      ) {
        return;
      }
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [overlay]);

  const you = data?.you;
  const rows: LeaderboardRow[] = [...(data?.top ?? [])];
  if (you && !rows.some((row) => row.isYou)) {
    rows.push({
      rank: you.rank,
      name: you.name,
      totalPoints: you.totalPoints,
      achievements: you.achievements,
      isYou: true,
    });
  }

  return (
    <section className="pointer-events-auto w-64 overflow-hidden rounded-md border border-white/10 bg-[#111418] text-slate-200">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-[#191d22] px-3 py-2 text-left text-xs font-semibold text-slate-200 hover:bg-[#22272d]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>Leaderboard · {you ? `#${you.rank}` : "#—"} · {you?.totalPoints ?? 0} pts</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="border-t border-white/10">
          <div className="grid grid-cols-[38px_1fr_64px] gap-2 px-3 py-2 text-[10px] font-semibold text-slate-500">
            <span>Rank</span>
            <span>Name</span>
            <span className="text-right">Points</span>
          </div>
          {error && !data ? (
            <p className="border-t border-white/10 px-3 py-3 text-xs text-slate-400">Leaderboard unavailable.</p>
          ) : rows.length ? (
            <ol className="max-h-64 overflow-y-auto">
              {rows.map((row) => (
                <li
                  className={`grid grid-cols-[38px_1fr_64px] gap-2 border-t border-white/5 px-3 py-2 text-xs ${
                    row.isYou ? "bg-[#283039] font-semibold text-white" : "text-slate-300"
                  }`}
                  key={`${row.rank}-${row.name}`}
                >
                  <span className="text-slate-400">{row.rank}</span>
                  <span className="truncate">{row.name}</span>
                  <span className="text-right tabular-nums">{row.totalPoints}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="border-t border-white/10 px-3 py-3 text-xs text-slate-400">
              {error ? "Leaderboard unavailable." : "Loading leaderboard…"}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
