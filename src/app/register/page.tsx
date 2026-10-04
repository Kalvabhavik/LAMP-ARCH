"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useQuestStore } from "@/stores/quest-store";
import { useGameStore } from "@/stores/game-store";
import { clearProgress } from "@/lib/persist/progress";

const CharacterPreview = dynamic(() => import("@/components/register/CharacterPreview"), { ssr: false });

const NAME_RE = /^[A-Za-z0-9 .'-]{1,40}$/;

export default function RegisterPage() {
  const router = useRouter();
  const status = useQuestStore((s) => s.status);
  const state = useQuestStore((s) => s.state);
  const error = useQuestStore((s) => s.error);
  const load = useQuestStore((s) => s.load);
  const register = useQuestStore((s) => s.register);
  const signOut = useQuestStore((s) => s.signOut);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [newGame, setNewGame] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      void load();
    }
  }, [load]);

  const valid = NAME_RE.test(name.trim());
  const alreadyRegistered = status === "ready" && state !== null && !newGame;

  const submit = async () => {
    const trimmed = name.trim();
    if (!NAME_RE.test(trimmed)) {
      setFormError("1–40 characters: letters, digits, spaces and . ' - only.");
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      const supabase = getBrowserSupabase();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) await supabase.auth.signInAnonymously();
      }
      await register(trimmed, gender);
      router.push("/play");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Registration failed — try again.");
      setBusy(false);
    }
  };

  const startNewGame = async () => {
    setBusy(true);
    await signOut();
    clearProgress();
    useGameStore.setState({ xp: 0, completedMissionIds: [], collectedCrystalIds: [], hydrated: false });
    useGameStore.getState().hydrate();
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signInAnonymously();
    setNewGame(true);
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-4 text-slate-100">
      <div className="w-full max-w-2xl rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-2xl shadow-cyan-500/10">
        <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-cyan-300">LAMP: The Server Quest</p>
        <h1 className="mt-1 text-2xl font-bold">Engineer registration</h1>

        {status === "loading" || status === "idle" ? (
          <p className="mt-8 animate-pulse text-center text-sm text-slate-400">Restoring your session…</p>
        ) : status === "not_configured" || status === "error" ? (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
            <p className="font-bold">Cannot reach the game service.</p>
            <p className="mt-1 text-xs text-red-300/80">{error ?? "Supabase is not configured — check your environment."}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg border border-red-400/50 px-4 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20"
            >
              Retry
            </button>
          </div>
        ) : alreadyRegistered ? (
          <div className="mt-6 rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-5 text-center">
            <p className="text-lg font-bold text-emerald-200">Welcome back, {state!.player.name}.</p>
            <p className="mt-1 text-xs text-slate-400">Your progress is saved — level {state!.quest.level} · {state!.player.score} pts</p>
            <div className="mt-4 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/play")}
                className="rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={() => void startNewGame()}
                disabled={busy}
                className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Start a new game
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="name" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
                Engineer name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="e.g. Sam Rivera"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm outline-none focus:border-cyan-400/60"
              />
              <p className="mt-1 text-[11px] text-slate-500">1–40 characters · letters, digits, spaces and . &apos; -</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(["female", "male"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGender(g)}
                  aria-pressed={gender === g}
                  className={`rounded-xl border-2 p-2 text-center transition ${
                    gender === g
                      ? g === "female"
                        ? "border-fuchsia-400 bg-fuchsia-500/10"
                        : "border-cyan-400 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-900/50 hover:border-slate-600"
                  }`}
                >
                  <div className="h-44 w-full">
                    <CharacterPreview gender={g} />
                  </div>
                  <p className={`mt-1 text-sm font-bold ${gender === g ? "text-slate-100" : "text-slate-400"}`}>
                    {g === "female" ? "Female" : "Male"}
                  </p>
                </button>
              ))}
            </div>

            {formError && (
              <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{formError}</p>
            )}

            <button
              type="button"
              disabled={!valid || busy}
              onClick={submit}
              className="w-full rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Entering the world…" : "Enter the world"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
