import { describe, expect, it } from "vitest";
import { applyScoreDelta, SCORE_RULES } from "@/lib/game/scoring";

describe("applyScoreDelta", () => {
  it("never drops below zero", () => {
    expect(applyScoreDelta(10, SCORE_RULES.failedSubmission)).toBe(0);
    expect(applyScoreDelta(10, SCORE_RULES.hintUsed)).toBe(0);
  });
  it("adds and subtracts normally otherwise", () => {
    expect(applyScoreDelta(100, SCORE_RULES.missionCompleted)).toBe(600);
    expect(applyScoreDelta(100, SCORE_RULES.hintUsed)).toBe(50);
  });
});
