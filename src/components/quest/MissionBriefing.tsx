"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPANIES } from "@/content/quest/companies";
import { getQuestMission } from "@/content/quest/missions";
import { PROCEDURE_SECTIONS } from "@/content/quest/procedure-rubric";
import { MILESTONE } from "@/lib/game/progression";
import type { ProcedureReview } from "@/types/procedure";
import type { ValidationResult } from "@/lib/validation/engine";
import { ApiError } from "@/lib/api/client";
import { playSfx } from "@/lib/audio/sfx";
import { useQuestStore } from "@/stores/quest-store";

type Tab = "brief" | "requirements" | "hints" | "submit" | "procedure";

const TABS: { id: Tab; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "requirements", label: "Requirements" },
  { id: "hints", label: "Hints" },
  { id: "submit", label: "Submit" },
  { id: "procedure", label: "Procedure" },
];

function statusPill(milestones: Set<string>, missionId: string, submission?: { status?: string }) {
  if (milestones.has(MILESTONE.missionDocumented(missionId))) return ["Documented", "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"];
  if (milestones.has(MILESTONE.missionPassed(missionId))) return ["Passed", "text-green-300 border-green-400/40 bg-green-500/10"];
  if (submission?.status === "needs_improvement") return ["Needs improvement", "text-amber-300 border-amber-400/40 bg-amber-500/10"];
  if (milestones.has(MILESTONE.missionAccepted(missionId))) return ["In progress", "text-cyan-300 border-cyan-400/40 bg-cyan-500/10"];
  return ["Not started", "text-slate-400 border-slate-600 bg-slate-800/60"];
}

export function MissionBriefing({ missionId, initialTab }: { missionId: string; initialTab?: Tab }) {
  const mission = getQuestMission(missionId);
  const store = useQuestStore();
  const [tab, setTab] = useState<Tab>(initialTab ?? "brief");
  const milestones = useMemo(() => new Set(store.state?.milestones ?? []), [store.state]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Escape") store.closeOverlay();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store]);

  if (!mission) return null;
  const company = COMPANIES.find((c) => c.id === mission.companyId);
  const accepted = milestones.has(MILESTONE.missionAccepted(missionId));
  const passed = milestones.has(MILESTONE.missionPassed(missionId));
  const submission = store.state?.submissions[missionId] as { status?: string; score?: number; attempt?: number } | undefined;
  const [pillLabel, pillClass] = statusPill(milestones, missionId, submission);

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl">
        {/* ticket header */}
        <div className="border-b border-white/10 px-5 pt-4 pb-3" style={{ boxShadow: `inset 0 3px 0 ${company?.color ?? "#22d3ee"}` }}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: company?.color }}>
              Ticket {mission.id}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pillClass}`}>{pillLabel}</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">{company?.name}</span>
            <button
              type="button"
              onClick={store.closeOverlay}
              className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-100">{mission.title}</h2>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-400">
            <span>Client: <b className="text-slate-300">{mission.client}</b></span>
            <span>Difficulty: <b className="text-slate-300">{mission.difficulty}</b></span>
            <span>Priority: <b className="text-amber-300">{mission.priority}</b></span>
            <span>Est: <b className="text-slate-300">{mission.estimatedTime}</b></span>
            <span>Deadline: <b className="text-slate-300">{mission.deadline}</b></span>
            <span>Assigned by <b className="text-slate-300">{company?.manager.name}</b></span>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-white/10 px-5 pt-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-lg px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                tab === t.id ? "bg-slate-800 text-cyan-300" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "brief" && <BriefTab missionId={missionId} accepted={accepted} />}
          {tab === "requirements" && <RequirementsTab missionId={missionId} />}
          {tab === "hints" && <HintsTab missionId={missionId} />}
          {tab === "submit" && <SubmitTab missionId={missionId} />}
          {tab === "procedure" && <ProcedureTab missionId={missionId} enabled={passed} />}
        </div>
      </div>
    </div>
  );
}

function BriefTab({ missionId, accepted }: { missionId: string; accepted: boolean }) {
  const mission = getQuestMission(missionId)!;
  const store = useQuestStore();
  return (
    <div className="space-y-3">
      {mission.brief.map((p, i) => (
        <p key={i} className="text-sm leading-relaxed text-slate-300">{p}</p>
      ))}
      {!accepted && (
        <button
          type="button"
          onClick={() => void store.acceptMission(missionId).catch((e) => store.pushToast("error", e.message))}
          className="mt-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
        >
          Accept mission
        </button>
      )}
    </div>
  );
}

function RequirementsTab({ missionId }: { missionId: string }) {
  const mission = getQuestMission(missionId)!;
  return (
    <div className="space-y-4 text-sm">
      <section>
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">Objectives</h3>
        <ul className="space-y-1">
          {mission.objectives.map((o, i) => (
            <li key={i} className="flex gap-2 text-slate-300"><span className="text-cyan-400">▹</span>{o}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">Constraints</h3>
        <ul className="space-y-1">
          {mission.constraints.map((c, i) => (
            <li key={i} className="flex gap-2 text-slate-300"><span className="text-amber-400">!</span>{c}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">Expected output</h3>
        <ul className="space-y-1">
          {mission.expectedOutput.map((o, i) => (
            <li key={i} className="flex gap-2 text-slate-300"><span className="text-emerald-400">✓</span>{o}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Accepted files: {mission.submission.allowedExtensions.join(" ")} · max {mission.submission.maxSizeMB} MB
        </p>
      </section>
    </div>
  );
}

function HintsTab({ missionId }: { missionId: string }) {
  const mission = getQuestMission(missionId)!;
  const store = useQuestStore();
  const unlocked = store.state?.hintsUnlocked[missionId] ?? [];
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">Hints cost <b className="text-amber-300">−50 pts</b> each. Revealed hints stay unlocked.</p>
      {mission.hints.map((hint, index) => {
        const revealed = unlocked.includes(index);
        return (
          <div key={index} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
            {revealed ? (
              <p className="text-sm text-slate-200">{hint}</p>
            ) : confirming === index ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-amber-200">Reveal hint {index + 1} for −50 pts?</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    store
                      .unlockHint(missionId, index)
                      .catch((e) => store.pushToast("error", e instanceof Error ? e.message : "Hint failed"))
                      .finally(() => {
                        setBusy(false);
                        setConfirming(null);
                      });
                  }}
                  className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                >
                  Reveal (−50)
                </button>
                <button type="button" onClick={() => setConfirming(null)} className="text-xs text-slate-400 underline">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(index)}
                className="flex w-full items-center gap-2 text-left text-sm text-slate-400 hover:text-slate-200"
              >
                <span>🔒</span> Hint {index + 1} — Reveal hint (−50 pts)
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SubmitTab({ missionId }: { missionId: string }) {
  const mission = getQuestMission(missionId)!;
  const store = useQuestStore();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const last = store.state?.submissions[missionId] as
    | { status?: string; score?: number; attempt?: number; fileName?: string; submittedAt?: string }
    | undefined;
  const passed = new Set(store.state?.milestones ?? []).has(MILESTONE.missionPassed(missionId));

  const pickFile = useCallback(
    (f: File | undefined | null) => {
      if (!f) return;
      const ext = `.${f.name.split(".").pop()?.toLowerCase() ?? ""}`;
      if (!mission.submission.allowedExtensions.includes(ext)) {
        setError(`"${f.name}" is not an accepted file type (${mission.submission.allowedExtensions.join(" ")}).`);
        setFile(null);
        return;
      }
      if (f.size > mission.submission.maxSizeMB * 1024 * 1024) {
        setError(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — max ${mission.submission.maxSizeMB} MB.`);
        setFile(null);
        return;
      }
      setError(null);
      setFile(f);
    },
    [mission],
  );

  const submit = async () => {
    if (!file) return;
    setChecking(true);
    setProgress(0);
    setResult(null);
    try {
      const res = (await store.submitSolution(missionId, file, setProgress)) as ValidationResult | undefined;
      setResult(res ?? null);
      if (res?.passed) playSfx("success");
      else playSfx("fail");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed — try again.");
      playSfx("fail");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {last && (
        <div className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
          Last attempt #{last.attempt}: <b className="text-slate-200">{last.fileName}</b> —{" "}
          <span className={last.status === "passed" ? "text-emerald-300" : "text-amber-300"}>{last.status}</span>
          {typeof last.score === "number" ? ` · score ${last.score}` : ""}
        </div>
      )}

      {passed && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          This mission already passed review — further uploads are disabled.
        </p>
      )}

      {!passed && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver ? "border-cyan-400 bg-cyan-500/10" : "border-slate-700 bg-slate-900/50 hover:border-slate-500"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept={mission.submission.allowedExtensions.join(",")}
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {file ? (
            <p className="text-slate-200">
              <b>{file.name}</b> <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
            </p>
          ) : (
            <p className="text-slate-400">
              Drop your solution here or <span className="text-cyan-300 underline">browse</span>
              <br />
              <span className="text-[11px] text-slate-500">
                {mission.submission.allowedExtensions.join(" ")} · max {mission.submission.maxSizeMB} MB
              </span>
            </p>
          )}
        </div>
      )}

      {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}

      {checking ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="animate-pulse text-center text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            {progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : "Checking submission…"}
          </p>
        </div>
      ) : (
        !passed && (
          <button
            type="button"
            disabled={!file}
            onClick={submit}
            className="w-full rounded-xl bg-cyan-500 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit for review
          </button>
        )
      )}

      {result && <ResultCard result={result} onResubmit={() => { setResult(null); setFile(null); }} canResubmit={!result.passed} />}
    </div>
  );
}

const LEVEL_NAMES: Record<number, string> = {
  1: "Files",
  2: "Keywords & config",
  3: "Code structure",
  4: "Commands",
  5: "Execution",
};

function ResultCard({ result, onResubmit, canResubmit }: { result: ValidationResult; onResubmit: () => void; canResubmit: boolean }) {
  const byLevel = new Map<number, typeof result.results>();
  for (const r of result.results) {
    const list = byLevel.get(r.level) ?? [];
    list.push(r);
    byLevel.set(r.level, list);
  }
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 text-lg font-bold"
          style={{
            borderColor: result.passed ? "#34d399" : "#f59e0b",
            color: result.passed ? "#34d399" : "#f59e0b",
          }}
        >
          {result.score}
        </div>
        <div>
          <p className={`text-lg font-bold tracking-wide ${result.passed ? "text-emerald-300" : "text-amber-300"}`}>
            {result.passed ? "PASSED" : "NEEDS IMPROVEMENT"}
          </p>
          <p className="text-xs text-slate-400">Reviewed against {result.results.length} requirements</p>
        </div>
      </div>
      {[...byLevel.entries()].sort(([a], [b]) => a - b).map(([level, reqs]) => (
        <div key={level}>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
            Level {level} · {LEVEL_NAMES[level] ?? "Checks"}
          </p>
          <ul className="space-y-0.5">
            {reqs.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-xs">
                <span className={r.status === "passed" ? "text-emerald-400" : r.status === "skipped" ? "text-slate-500" : "text-red-400"}>
                  {r.status === "passed" ? "✓" : r.status === "skipped" ? "—" : "✗"}
                </span>
                <span className="text-slate-300">
                  {r.label}
                  {r.status === "skipped" && <span className="text-slate-500"> — Not run (sandbox not configured)</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {result.feedback.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-red-300">What to fix</p>
          <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-300">
            {result.feedback.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
      {result.suggestions.length > 0 && (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-400">
          {result.suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
      {result.warnings.length > 0 && (
        <p className="text-[11px] text-slate-500">{result.warnings.join(" ")}</p>
      )}
      {canResubmit && (
        <button type="button" onClick={onResubmit} className="rounded-lg border border-cyan-400/40 px-4 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/10">
          Resubmit
        </button>
      )}
    </div>
  );
}

const PROCEDURE_TEMPLATE = PROCEDURE_SECTIONS.map((s) => `## ${s.label}\n\n`).join("\n");

function ProcedureTab({ missionId, enabled }: { missionId: string; enabled: boolean }) {
  const mission = getQuestMission(missionId)!;
  const store = useQuestStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ProcedureReview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const last = store.state?.procedures[missionId] as { status?: string; score?: number } | undefined;
  const minWords = mission.procedure.minWords;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (!enabled) {
    return <p className="text-sm text-slate-400">Pass the implementation review first — then document your procedure here.</p>;
  }

  const submit = async (payload: { text: string; format: "markdown" } | { file: File }) => {
    setBusy(true);
    setError(null);
    try {
      const res = (await store.submitProcedure(missionId, payload)) as ProcedureReview | undefined;
      setReview(res ?? null);
      if (res?.accepted) playSfx("success");
      else playSfx("fail");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Submission failed — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 text-sm">
      {last && (
        <div className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
          Last procedure: <span className="text-slate-200">{last.status}</span>
          {typeof last.score === "number" ? ` · score ${last.score}` : ""}
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder="Document your procedure in markdown…"
        className="w-full rounded-xl border border-slate-700 bg-slate-900/70 p-3 font-mono text-xs text-slate-200 outline-none focus:border-cyan-400/60"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setText((t) => (t.trim() ? t : PROCEDURE_TEMPLATE))}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          Insert rubric template
        </button>
        <span className={`text-xs ${wordCount >= minWords ? "text-emerald-300" : "text-slate-400"}`}>
          {wordCount} / {minWords} words
        </span>
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Upload .md/.txt/.pdf
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".md,.txt,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void submit({ file: f });
            }}
          />
          <button
            type="button"
            disabled={busy || wordCount < 20}
            onClick={() => void submit({ text, format: "markdown" })}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            {busy ? "Reviewing…" : "Submit procedure"}
          </button>
        </span>
      </div>
      {error && <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
      {review && <ProcedureResult review={review} />}
    </div>
  );
}

function ProcedureResult({ review }: { review: ProcedureReview }) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-center gap-4">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border-4 text-base font-bold"
          style={{ borderColor: review.accepted ? "#34d399" : "#f59e0b", color: review.accepted ? "#34d399" : "#f59e0b" }}
        >
          {review.score}
        </div>
        <p className={`font-bold ${review.accepted ? "text-emerald-300" : "text-amber-300"}`}>
          {review.accepted ? (review.complete ? "ACCEPTED — COMPLETE" : "ACCEPTED") : "NEEDS IMPROVEMENT"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {review.sections.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className={s.status === "present" ? "text-emerald-400" : s.status === "mentioned" ? "text-amber-400" : "text-red-400"}>
              {s.status === "present" ? "✓" : s.status === "mentioned" ? "◐" : "✗"}
            </span>
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {review.topics.map((t) => (
          <span
            key={t.id}
            className={`rounded-full border px-2 py-0.5 text-[10px] ${
              t.covered ? "border-emerald-400/40 text-emerald-300" : "border-slate-600 text-slate-400"
            }`}
          >
            {t.label}
          </span>
        ))}
      </div>
      <ul className="list-inside list-disc space-y-0.5 text-xs text-slate-300">
        {review.feedback.map((f, i) => <li key={i}>{f}</li>)}
      </ul>
    </div>
  );
}
