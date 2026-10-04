"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { MapStrip, XpBar } from "@/components/hud/HudChrome";
import { MissionPanel } from "@/components/hud/MissionPanel";
import {
  AchievementPopup,
  HudButtons,
  MissionTracker,
  ObjectiveBanner,
  PlayerCard,
  ToastStack,
} from "@/components/hud/QuestHud";
import { ControlsHint, WorldOverlay, WorldStatus } from "@/components/hud/WorldHud";
import { DialogueBox } from "@/components/quest/DialogueBox";
import { MissionBriefing } from "@/components/quest/MissionBriefing";
import { QuestOverlayHost } from "@/components/quest/QuestOverlays";
import { TutorPanel } from "@/features/tutor/TutorPanel";
import { MILESTONE } from "@/lib/game/progression";
import { useGameStore } from "@/stores/game-store";
import { useQuestStore } from "@/stores/quest-store";

const WorldCanvas = dynamic(() => import("@/components/world/WorldCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">
      Generating mountain valley…
    </div>
  ),
});

/** Sync local training progress up to the server (debounced) and down on load. */
function useTrainingSync() {
  const hydrated = useGameStore((s) => s.hydrated);
  const hydratedFromServer = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const apply = () => {
      const quest = useQuestStore.getState();
      if (quest.status !== "ready" || !quest.state) return;
      if (!hydratedFromServer.current) {
        hydratedFromServer.current = true;
        useGameStore.getState().hydrateFromServer(quest.state.training);
        return;
      }
      const g = useGameStore.getState();
      quest.syncTraining({ xp: g.xp, completedMissionIds: g.completedMissionIds, collectedCrystalIds: g.collectedCrystalIds });
    };
    apply();
    const unsub = useGameStore.subscribe((state, prev) => {
      if (
        state.xp !== prev.xp ||
        state.completedMissionIds !== prev.completedMissionIds ||
        state.collectedCrystalIds !== prev.collectedCrystalIds
      ) {
        apply();
      }
    });
    const unsubQuest = useQuestStore.subscribe((state, prev) => {
      if (state.status === "ready" && prev.status !== "ready") apply();
    });
    return () => {
      unsub();
      unsubQuest();
    };
  }, [hydrated]);
}

/** Celebration overlays when pass/document milestones appear; completion at game end. */
function useCelebrations() {
  const overlay = useQuestStore((s) => s.overlay);
  const state = useQuestStore((s) => s.state);
  // Milestones present at load are the baseline — only in-session gains celebrate.
  const baseline = useRef<Set<string> | null>(null);
  const celebrated = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state) return;
    const current = new Set(state.milestones);
    if (baseline.current === null) {
      baseline.current = current;
      // Returning player who already finished: offer the certificate once.
      if (current.has(MILESTONE.gameCompleted)) useQuestStore.getState().openOverlay("completion");
      return;
    }
    if (overlay !== "none") return; // re-evaluates when the overlay closes
    const pending = (key: string) => current.has(key) && !baseline.current!.has(key) && !celebrated.current.has(key);
    const store = useQuestStore.getState();
    if (pending(MILESTONE.gameCompleted)) {
      store.openOverlay("completion");
      celebrated.current.add(MILESTONE.gameCompleted);
      for (const missionId of ["BF-001", "NC-001"]) {
        celebrated.current.add(MILESTONE.missionPassed(missionId)).add(MILESTONE.missionDocumented(missionId));
      }
      return;
    }
    for (const missionId of ["BF-001", "NC-001"]) {
      if (pending(MILESTONE.missionDocumented(missionId))) {
        store.openOverlay("celebration", {
          title: "TICKET CLOSED",
          subtitle: `${missionId} passed and documented. Outstanding work, engineer.`,
        });
        celebrated.current.add(MILESTONE.missionDocumented(missionId));
        return;
      }
      if (pending(MILESTONE.missionPassed(missionId))) {
        store.openOverlay("celebration", {
          title: "MISSION COMPLETE",
          subtitle: `${missionId} passed review — now document your procedure to finish the ticket.`,
        });
        celebrated.current.add(MILESTONE.missionPassed(missionId));
        return;
      }
    }
  }, [state, overlay]);
}

export function GameShell() {
  const hydrate = useGameStore((state) => state.hydrate);
  const hydrated = useGameStore((state) => state.hydrated);
  const panel = useGameStore((state) => state.panel);
  const setPanel = useGameStore((state) => state.setPanel);
  const questOverlay = useQuestStore((s) => s.overlay);
  const questOverlayData = useQuestStore((s) => s.overlayData) as Record<string, unknown> | null;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useTrainingSync();
  useCelebrations();

  const stationOpen = panel === "learn" || panel === "practice" || panel === "diy";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950">
      <WorldCanvas />
      <WorldOverlay />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="pointer-events-auto">
            <PlayerCard />
            <p className="mb-1 ml-1 text-[9px] font-bold tracking-[0.3em] text-cyan-300/70">TRAINING XP</p>
            <XpBar />
            <WorldStatus />
            <div className="mt-2">
              <HudButtons />
            </div>
          </div>
          <MapStrip />
        </div>
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-end">
          {hydrated && stationOpen ? (
            <MissionPanel />
          ) : questOverlay === "none" ? (
            <div className="flex flex-1">
              <ControlsHint />
            </div>
          ) : null}
          {panel === "tutor" || stationOpen ? (
            <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-violet-400/20 bg-slate-950/90 p-4 backdrop-blur-md">
              <TutorPanel />
              {panel === "tutor" && !stationOpen ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-slate-400 underline"
                  onClick={() => setPanel("none")}
                >
                  Hide tutor
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[100px] -translate-x-1/2 sm:top-[80px]">
        <ObjectiveBanner />
      </div>
      <div className="pointer-events-none absolute right-4 top-[264px] hidden sm:block">
        <MissionTracker />
      </div>
      <ToastStack />
      <AchievementPopup />
      <QuestOverlayHost />
      {questOverlay === "dialogue" && questOverlayData ? (
        <DialogueBox
          npcId={questOverlayData.npcId as string}
          companyId={questOverlayData.companyId as string}
        />
      ) : null}
      {questOverlay === "briefing" && questOverlayData ? (
        <MissionBriefing
          missionId={questOverlayData.missionId as string}
          initialTab={questOverlayData.tab as never}
        />
      ) : null}
    </div>
  );
}
