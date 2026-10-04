"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GAME_CONFIG } from "@/config/game";
import { KIOSKS, type KioskDefinition } from "@/content/quest/kiosks";
import { MILESTONE } from "@/lib/game/progression";
import { playSfx } from "@/lib/audio/sfx";
import { useQuestStore } from "@/stores/quest-store";
import { SitePopup } from "@/components/quest/SitePopup";
import type { StationId } from "@/types/game";

function Panel({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const closeOverlay = useQuestStore((s) => s.closeOverlay);
  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl border border-violet-400/30 bg-slate-950/95 p-6 shadow-2xl shadow-violet-500/20`}>
        <button
          type="button"
          onClick={closeOverlay}
          className="absolute right-3 top-3 rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
          aria-label="Close"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function MagicBoxOverlay() {
  const router = useRouter();
  const store = useQuestStore();
  return (
    <Panel>
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-violet-300">Ancient artifact</p>
      <h2 className="mt-1 text-2xl font-bold text-violet-200">The Magic Box</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        The box hums… a mission file materialises. Inside is a dossier describing a world of companies that
        run real servers — and they are hiring an engineer who can deliver.
      </p>
      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => {
            void store.postMilestone(MILESTONE.openedMissionPortal);
            store.closeOverlay();
            const url = GAME_CONFIG.MAGIC_BOX_EXTERNAL_URL;
            if (/^https?:\/\//.test(url) && new URL(url).origin !== window.location.origin) {
              window.open(url, "_blank", "noopener");
            } else {
              router.push(url);
            }
          }}
          className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:bg-violet-400"
        >
          Open Mission
        </button>
        <button
          type="button"
          onClick={store.closeOverlay}
          className="rounded-xl border border-slate-700 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          Later
        </button>
      </div>
    </Panel>
  );
}

export function HubIntroOverlay() {
  const closeOverlay = useQuestStore((s) => s.closeOverlay);
  return (
    <Panel wide>
      <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-300">Introduction Hub</p>
      <h2 className="mt-1 text-2xl font-bold text-slate-100">Welcome to the Server Quest</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
        <p>This world is a working town of tech companies. Two are hiring: <b className="text-orange-300">ByteForge Solutions</b> (west) and <b className="text-cyan-300">NexaCore Technologies</b> (east).</p>
        <p>Companies hand you <b>real tickets</b> — not quizzes. You write actual commands, SQL and PHP, zip them up, and an automated reviewer checks every requirement.</p>
        <p>After your implementation passes, you <b>document the procedure</b> — real engineers write runbooks. Both parts must pass to complete a company.</p>
        <p>Hints exist if you get stuck, but they cost points. The glowing training stations around the plaza teach the fundamentals whenever you need a refresher.</p>
      </div>
      <button
        type="button"
        onClick={closeOverlay}
        className="mt-5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400"
      >
        Head to ByteForge →
      </button>
    </Panel>
  );
}

export function InfoOverlay({ kiosk }: { kiosk: KioskDefinition }) {
  return (
    <Panel>
      <p className="text-[10px] font-bold uppercase tracking-[0.35em]" style={{ color: kiosk.accent }}>
        Info kiosk
      </p>
      <h2 className="mt-1 text-2xl font-bold text-slate-100">{kiosk.title}</h2>
      <ul className="mt-3 space-y-2">
        {kiosk.lines.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-300">
            <span style={{ color: kiosk.accent }}>▹</span>
            {line}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function CelebrationOverlay({ title, subtitle }: { title: string; subtitle: string }) {
  const closeOverlay = useQuestStore((s) => s.closeOverlay);
  useEffect(() => {
    playSfx("achievement");
  }, []);
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/40 bg-slate-950/95 p-8 text-center shadow-2xl shadow-amber-500/20">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 h-2 w-1.5 animate-[confetti_1.6s_ease-in_infinite]"
            style={{
              left: `${(i * 41) % 100}%`,
              background: ["#22d3ee", "#f59e0b", "#a78bfa", "#34d399", "#f472b6"][i % 5],
              animationDelay: `${(i % 12) * 0.12}s`,
            }}
          />
        ))}
        <p className="text-4xl">🏆</p>
        <h2 className="mt-2 text-2xl font-bold tracking-wide text-amber-300">{title}</h2>
        <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
        <button
          type="button"
          onClick={closeOverlay}
          className="mt-5 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300"
        >
          Continue
        </button>
        <style>{`@keyframes confetti { 0%{transform:translateY(-10px) rotate(0)} 100%{transform:translateY(340px) rotate(540deg)} }`}</style>
      </div>
    </div>
  );
}

export function CompletionOverlay() {
  const state = useQuestStore((s) => s.state);
  const closeOverlay = useQuestStore((s) => s.closeOverlay);
  const signOut = useQuestStore((s) => s.signOut);
  const router = useRouter();
  if (!state) return null;
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border-2 border-cyan-300/50 bg-slate-950/95 p-8 text-center shadow-2xl shadow-cyan-500/30">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-300">Certificate of completion</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-100">LAMP: The Server Quest</h2>
        <p className="mt-4 text-sm text-slate-400">This certifies that</p>
        <p className="mt-1 text-2xl font-bold text-cyan-200">{state.player.name}</p>
        <p className="mt-1 text-sm text-slate-400">
          deployed and documented production-grade LAMP stacks for ByteForge Solutions and NexaCore Technologies.
        </p>
        <div className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm">
          <span className="text-slate-400">Final score</span>
          <span className="font-bold text-amber-300">{state.player.score} pts</span>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {state.achievements.map((a) => (
            <span key={a.key} className="rounded-full border border-amber-400/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] text-amber-200">
              ★ {a.name}
            </span>
          ))}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/register");
            }}
            className="rounded-xl border border-slate-600 px-5 py-2.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            Play again
          </button>
          <button
            type="button"
            onClick={closeOverlay}
            className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400"
          >
            Back to world
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuestOverlayHost() {
  const overlay = useQuestStore((s) => s.overlay);
  const data = useQuestStore((s) => s.overlayData) as Record<string, unknown> | null;
  switch (overlay) {
    case "magic_box":
      return <MagicBoxOverlay />;
    case "hub_intro":
      return <HubIntroOverlay />;
    case "info":
      return <InfoOverlay kiosk={(data as KioskDefinition) ?? KIOSKS[0]} />;
    case "site":
      return <SitePopup siteId={data?.siteId as StationId} />;
    case "celebration":
      return <CelebrationOverlay title={(data?.title as string) ?? "MISSION COMPLETE"} subtitle={(data?.subtitle as string) ?? ""} />;
    case "completion":
      return <CompletionOverlay />;
    default:
      return null;
  }
}
