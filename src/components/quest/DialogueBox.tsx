"use client";

import { useEffect, useRef, useState } from "react";
import { getCharacter } from "@/content/characters";
import { COMPANIES } from "@/content/quest/companies";
import { getDialogue, type DialogueAction } from "@/content/quest/dialogue";
import { MILESTONE } from "@/lib/game/progression";
import { playSfx } from "@/lib/audio/sfx";
import { useQuestStore } from "@/stores/quest-store";

function missionStateOf(milestones: Set<string>, missionId: string): "none" | "accepted" | "passed" | "documented" {
  if (milestones.has(MILESTONE.missionDocumented(missionId))) return "documented";
  if (milestones.has(MILESTONE.missionPassed(missionId))) return "passed";
  if (milestones.has(MILESTONE.missionAccepted(missionId))) return "accepted";
  return "none";
}

export function DialogueBox({ npcId, companyId }: { npcId: string; companyId: string }) {
  const dialogue = getDialogue(npcId);
  const company = COMPANIES.find((c) => c.id === companyId);
  const character = getCharacter(npcId);
  const store = useQuestStore();
  const milestones = new Set(store.state?.milestones ?? []);
  const entry = dialogue ? dialogue.entry(missionStateOf(milestones, dialogue.missionId)) : "intro";
  const [nodeId, setNodeId] = useState(entry);
  const [typed, setTyped] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const node = dialogue?.nodes[nodeId] ?? dialogue?.nodes[entry];

  useEffect(() => {
    if (!node) return;
    timer.current = setInterval(() => {
      setTyped((v) => {
        if (v >= node.text.length) {
          if (timer.current) clearInterval(timer.current);
          return v;
        }
        return v + 2;
      });
    }, 18);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [nodeId, node]);

  if (!dialogue || !node || !company) return null;

  const done = typed >= node.text.length;
  const skip = () => setTyped(node.text.length);

  const goTo = (next: string) => {
    setTyped(0);
    setNodeId(next);
  };

  const runAction = (action: DialogueAction) => {
    playSfx("click");
    switch (action) {
      case "accept_mission":
        void store.acceptMission(dialogue.missionId).then(() => {
          const updated = new Set(useQuestStore.getState().state?.milestones ?? []);
          goTo(dialogue.entry(missionStateOf(updated, dialogue.missionId)));
          store.openOverlay("briefing", { missionId: dialogue.missionId });
        }).catch(() => store.openOverlay("briefing", { missionId: dialogue.missionId }));
        return;
      case "open_briefing":
        store.openOverlay("briefing", { missionId: dialogue.missionId, tab: "brief" });
        return;
      case "open_hints":
        store.openOverlay("briefing", { missionId: dialogue.missionId, tab: "hints" });
        return;
      case "open_submit":
        store.openOverlay("briefing", { missionId: dialogue.missionId, tab: "submit" });
        return;
      case "open_procedure":
        store.openOverlay("briefing", { missionId: dialogue.missionId, tab: "procedure" });
        return;
      case "close":
        store.closeOverlay();
        return;
    }
  };

  return (
    <div
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 flex justify-center p-4"
      onClick={skip}
      role="dialog"
      aria-label={`Dialogue with ${company.manager.name}`}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-4 shadow-2xl shadow-cyan-500/10 backdrop-blur-md">
        <div className="flex gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold"
            style={{ borderColor: character.palette.accent, background: `${character.palette.jacket}55`, color: character.palette.accent }}
          >
            {company.manager.name.split(" ").map((w) => w[0]).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold" style={{ color: character.palette.accent }}>
                {company.manager.name}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                {company.manager.title} · {company.name}
              </span>
            </div>
            <p className="mt-1 min-h-[3.5rem] text-sm leading-relaxed text-slate-200">
              {node.text.slice(0, typed)}
              {!done && <span className="animate-pulse text-cyan-300">▌</span>}
            </p>
          </div>
        </div>
        {done && (
          <div className="mt-3 flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
            {node.options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => (option.action ? runAction(option.action) : goTo(option.next ?? nodeId))}
                className="flex items-center gap-2.5 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-cyan-400/50 hover:bg-slate-800"
              >
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1.5 text-[10px] text-cyan-300">{index + 1}</kbd>
                {option.label}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-right text-[10px] uppercase tracking-widest text-slate-500">click to continue · esc to leave</p>
      </div>
      <DialogueKeys options={node.options} done={done} onPick={(o) => (o.action ? runAction(o.action) : goTo(o.next ?? nodeId))} onClose={store.closeOverlay} onSkip={skip} />
    </div>
  );
}

function DialogueKeys({
  options,
  done,
  onPick,
  onClose,
  onSkip,
}: {
  options: { next?: string; action?: DialogueAction }[];
  done: boolean;
  onPick: (o: { next?: string; action?: DialogueAction }) => void;
  onClose: () => void;
  onSkip: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        onClose();
        return;
      }
      if (!done && (event.code === "Space" || event.code === "Enter")) {
        event.preventDefault();
        onSkip();
        return;
      }
      if (done && /^Digit[1-9]$/.test(event.code)) {
        const index = Number(event.code.slice(5)) - 1;
        const option = options[index];
        if (option) onPick(option);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [options, done, onPick, onClose, onSkip]);
  return null;
}
