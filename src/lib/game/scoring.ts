export const SCORE_RULES = {
  missionCompleted: 500,
  correctImplementation: 300,
  goodProcedure: 200,
  noHints: 100,
  firstSubmissionSuccess: 100,
  hintUsed: -50,
  failedSubmission: -25,
} as const;

export type ScoreReason = keyof typeof SCORE_RULES;

export const SCORE_REASON_LABEL: Record<ScoreReason, string> = {
  missionCompleted: "Mission completed",
  correctImplementation: "Correct implementation (100/100)",
  goodProcedure: "Procedure accepted",
  noHints: "Completed without hints",
  firstSubmissionSuccess: "Passed on first submission",
  hintUsed: "Hint unlocked",
  failedSubmission: "Submission needs improvement",
};

/** Player score never drops below zero. */
export function applyScoreDelta(score: number, delta: number) {
  return Math.max(0, score + delta);
}
