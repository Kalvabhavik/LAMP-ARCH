"use client";

import { useState } from "react";
import { LearningPanel } from "@/components/hud/LearningPanel";
import { ModeTabs, StationChip } from "@/components/hud/HudChrome";
import { getMission } from "@/content/missions";
import { STATION_ORDER } from "@/constants/stations";
import { TerminalPanel } from "@/features/terminal/TerminalPanel";
import { useGameStore } from "@/stores/game-store";

export function MissionPanel() {
  const activeStationId = useGameStore((state) => state.activeStationId);
  const activeMissionId = useGameStore((state) => state.activeMissionId);
  const currentStepIndex = useGameStore((state) => state.currentStepIndex);
  const completedMissionIds = useGameStore((state) => state.completedMissionIds);
  const xp = useGameStore((state) => state.xp);
  const closePanel = useGameStore((state) => state.closePanel);
  const unlockedStationIds = useGameStore((state) => state.unlockedStationIds);
  const unlockedModes = useGameStore((state) => state.unlockedModes);
  const submitCommand = useGameStore((state) => state.submitCommand);
  const submitQuiz = useGameStore((state) => state.submitQuiz);
  const submitChecklist = useGameStore((state) => state.submitChecklist);
  const askTutor = useGameStore((state) => state.askTutor);
  const [feedback, setFeedback] = useState<string | null>(null);

  const mission = activeMissionId ? getMission(activeMissionId) : undefined;
  const step = mission?.steps[currentStepIndex];
  const complete = Boolean(mission && currentStepIndex >= mission.steps.length);
  const isFinalComplete = completedMissionIds.includes("lamp-final");
  const nextMode = activeStationId
    ? (["learn", "practice", "diy"] as const).find(
        (mode) => unlockedModes[activeStationId]?.includes(mode) && !completedMissionIds.includes(`${activeStationId}-${mode}`),
      )
    : undefined;
  const nextStation = activeStationId
    ? STATION_ORDER.slice(STATION_ORDER.indexOf(activeStationId) + 1).find((station) => unlockedStationIds.includes(station))
    : undefined;
  const destinationStation = nextMode ? activeStationId : nextStation;
  const canOpenNextStation = Boolean(destinationStation);
  const nextStationLabel = nextMode
    ? `${activeStationId} ${nextMode}`
    : nextStation === "lamp"
      ? "LAMP Hub"
      : nextStation === "aws"
        ? "AWS Deploy"
        : nextStation
          ? `${nextStation[0].toUpperCase()}${nextStation.slice(1)}`
          : "the campus";
  const exitToHomeAndTravel = () => {
    if (!destinationStation) {
      closePanel();
      return;
    }
    window.dispatchEvent(new CustomEvent("lampquest:travel", { detail: { stationId: destinationStation } }));
    closePanel();
  };

  if (!mission) return null;

  if (mission.id === "lamp-final" && complete) {
    return (
      <div className="pointer-events-auto flex max-h-[min(72vh,640px)] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-2xl shadow-cyan-400/20 backdrop-blur-xl ring-1 ring-cyan-400/10">
        <div className="text-center">
          <div className="mb-4 relative inline-block">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
            <div className="relative text-6xl">🎉</div>
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
            LAMP Quest Complete!
          </h2>
          <p className="mt-3 text-slate-300 text-lg">
            Congratulations! You have mastered the fundamentals of the LAMP stack.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-5 shadow-lg shadow-emerald-400/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <h3 className="font-bold text-emerald-300 text-lg">Your Achievements</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50">
              <span className="text-slate-400">Total XP Earned</span>
              <span className="font-bold text-emerald-400 text-lg">{xp} XP</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50">
              <span className="text-slate-400">Missions Completed</span>
              <span className="font-bold text-cyan-400 text-lg">{completedMissionIds.length}</span>
            </div>
            <div className="flex justify-between items-center p-2 rounded-lg bg-slate-900/50">
              <span className="text-slate-400">Level Achieved</span>
              <span className="font-bold text-violet-400 text-lg">{Math.floor(xp / 100) + 1}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-blue-600/5 p-5 shadow-lg shadow-cyan-400/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
            <h3 className="font-bold text-cyan-300 text-lg">What You&apos;ve Learned</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {[
              "Linux fundamentals and shell commands",
              "Apache web server configuration",
              "PHP server-side programming",
              "MySQL database management",
              "LAMP stack integration",
              "AWS cloud deployment concepts",
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-slate-300">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-400 text-xs font-bold">
                  {index + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-purple-600/5 p-5 shadow-lg shadow-violet-400/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse"></div>
            <h3 className="font-bold text-violet-300 text-lg">Next Steps</h3>
          </div>
          <p className="mt-2 text-sm text-slate-300 mb-3">
            You now have the foundation to deploy real web applications. Consider:
          </p>
          <ul className="space-y-2 text-sm">
            {[
              "Deploy a real LAMP stack on AWS EC2",
              "Build a dynamic PHP application",
              "Learn about security best practices",
              "Explore containerization with Docker",
            ].map((item, index) => (
              <li key={index} className="flex items-center gap-2 text-slate-300">
                <span className="text-violet-400">→</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={closePanel}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-400/30 hover:shadow-cyan-400/50 transition-all duration-300 hover:scale-105"
        >
          Return to Campus
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex max-h-[min(72vh,640px)] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-2xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-2xl shadow-cyan-400/20 backdrop-blur-xl ring-1 ring-cyan-400/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <StationChip />
          <h2 className="mt-2 text-xl font-bold text-white">{mission.title}</h2>
          <p className="text-sm text-slate-400 mt-1">{mission.summary}</p>
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-lg bg-slate-800/50 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-all duration-300"
        >
          ✕
        </button>
      </div>
      <ModeTabs />

      {complete ? (
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400/20 to-green-400/20 rounded-xl blur-md"></div>
          <div className="relative rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-green-600/5 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-2xl">✅</div>
              <p className="font-bold text-emerald-300 text-lg">Mission Complete</p>
            </div>
            <p className="text-sm text-emerald-100/90">
              You earned <span className="font-bold text-emerald-300">{mission.xp} XP</span>. Your next station is now available on the campus map.
            </p>
            {canOpenNextStation && nextStation ? (
              <button
                type="button"
                onClick={exitToHomeAndTravel}
                className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-400"
              >
                Exit to Home → Travel to {nextStationLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : step?.type === "read" ? (
        <LearningPanel key={step.id} step={step} />
      ) : step?.type === "command" ? (
        <div key={step.id} className="space-y-3">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/10 to-blue-400/10 rounded-lg blur-md"></div>
            <div className="relative bg-slate-900/50 rounded-lg p-4 border border-cyan-400/20">
              <p className="text-sm font-medium text-slate-200">{step.prompt}</p>
            </div>
          </div>
          <TerminalPanel
            shell={step.shell}
            onSubmit={(command, output) => {
              const result = submitCommand(command, output);
              setFeedback(result.ok ? "✓ Correct — next step unlocked." : result.hint ?? "Try again.");
            }}
          />
        </div>
      ) : step?.type === "quiz" ? (
        <QuizStep
          key={step.id}
          question={step.question}
          choices={step.choices}
          onChoose={(choice) => {
            const result = submitQuiz(choice);
            setFeedback(result.ok ? "✓ Correct." : result.hint ?? "Not quite.");
          }}
        />
      ) : step?.type === "checklist" ? (
        <ChecklistStep
          key={step.id}
          items={step.items}
          onSubmit={(values) => {
            const result = submitChecklist(values);
            setFeedback(result.ok ? "✓ Checklist complete." : result.hint ?? "Check every box.");
          }}
        />
      ) : null}

      {feedback && !complete ? (
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-yellow-400/20 rounded-lg blur-md"></div>
          <div className="relative rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-amber-200">{feedback}</p>
          </div>
        </div>
      ) : null}

      {!complete && step ? (
        <button
          type="button"
          className="self-start flex items-center gap-2 text-xs font-semibold text-violet-300 hover:text-violet-200 transition-colors duration-300"
          onClick={() => void askTutor("I am stuck on this step. Give me a hint.")}
        >
          <span className="text-lg">🤖</span>
          Ask tutor for a hint
        </button>
      ) : null}
    </div>
  );
}

function ChecklistStep({
  items,
  onSubmit,
}: {
  items: string[];
  onSubmit: (checked: boolean[]) => void;
}) {
  const [checked, setChecked] = useState(() => items.map(() => false));

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-green-400/10 to-emerald-400/10 rounded-lg blur-md"></div>
        <div className="relative bg-slate-900/50 rounded-lg p-4 border border-green-400/20">
          <p className="text-sm font-medium text-slate-300">Check every item when you can explain it.</p>
        </div>
      </div>
      {items.map((item, index) => (
        <label key={item} className="flex items-start gap-3 text-sm text-slate-200 cursor-pointer hover:bg-slate-800/30 rounded-lg p-2 transition-all duration-300">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-green-400 focus:ring-green-400 focus:ring-offset-slate-900"
            checked={checked[index] ?? false}
            onChange={(event) => {
              const next = [...checked];
              next[index] = event.target.checked;
              setChecked(next);
            }}
          />
          <span className="flex-1">{item}</span>
        </label>
      ))}
      <button
        type="button"
        className="w-full rounded-lg bg-gradient-to-r from-green-400 to-emerald-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-green-400/30 hover:shadow-green-400/50 transition-all duration-300 hover:scale-105"
        onClick={() => onSubmit(checked)}
      >
        Submit Checklist
      </button>
    </div>
  );
}

function QuizStep({
  question,
  choices,
  onChoose,
}: {
  question: string;
  choices: string[];
  onChoose: (choice: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-violet-400/10 to-purple-400/10 rounded-lg blur-md"></div>
        <div className="relative bg-slate-900/50 rounded-lg p-4 border border-violet-400/20">
          <p className="text-sm font-bold text-white">{question}</p>
        </div>
      </div>
      <div className="grid gap-2">
        {choices.map((choice, index) => (
          <button
            key={choice}
            type="button"
            onClick={() => onChoose(index)}
            className="relative rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-left text-sm text-slate-200 hover:border-violet-400/40 hover:bg-slate-800/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-400/20 text-violet-400 text-xs font-bold">
                {index + 1}
              </span>
              {choice}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
