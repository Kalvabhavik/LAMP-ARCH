"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useQuestStore } from "@/stores/quest-store";

const GameShell = dynamic(() => import("@/components/GameShell").then((m) => m.GameShell), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center bg-slate-950 text-sm text-slate-400">
      Loading world engine…
    </div>
  ),
});

export default function PlayPage() {
  const status = useQuestStore((s) => s.status);
  const error = useQuestStore((s) => s.error);
  const load = useQuestStore((s) => s.load);
  const router = useRouter();

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  useEffect(() => {
    if (status === "needs_registration") router.replace("/register");
  }, [status, router]);

  if (status === "ready") return <GameShell />;

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300">
      {status === "error" || status === "not_configured" ? (
        <>
          <p className="text-sm font-bold text-red-300">Could not load your world.</p>
          <p className="max-w-sm text-center text-xs text-slate-400">{error ?? "Service unavailable."}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 rounded-xl border border-cyan-400/40 px-5 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-500/10"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Restoring your world…</p>
        </>
      )}
    </div>
  );
}
