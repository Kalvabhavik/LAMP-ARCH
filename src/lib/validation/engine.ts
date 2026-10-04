import type { MissionDefinition } from "@/types/mission";
import type { ExtractedBundle } from "@/lib/validation/extract";
import { evaluateRule } from "@/lib/validation/rules";

export type RequirementResult = {
  id: string;
  label: string;
  level: number;
  status: "passed" | "failed" | "skipped";
  critical: boolean;
  feedback?: string;
  suggestion?: string;
};

export type ValidationResult = {
  /** round(passedWeight / totalWeight * 100); skipped requirements are excluded. */
  score: number;
  /** score >= passThreshold AND every critical requirement passed. */
  passed: boolean;
  results: RequirementResult[];
  /** failFeedback of failed requirements, critical ones first. */
  feedback: string[];
  suggestions: string[];
  warnings: string[];
};

/** Pure, synchronous submission validation — reusable for any mission. */
export function validateSubmission(mission: MissionDefinition, bundle: ExtractedBundle): ValidationResult {
  const results: RequirementResult[] = mission.requirements.map((req) => {
    const status = evaluateRule(req.rule, bundle.files);
    return {
      id: req.id,
      label: req.label,
      level: req.level,
      status,
      critical: req.critical ?? false,
      feedback: status === "failed" ? req.failFeedback : undefined,
      suggestion: status === "failed" ? req.suggestion : undefined,
    };
  });

  const scored = mission.requirements.filter((req, i) => results[i].status !== "skipped");
  const totalWeight = scored.reduce((sum, r) => sum + r.weight, 0);
  const passedWeight = scored.reduce((sum, r) => {
    const idx = mission.requirements.indexOf(r);
    return sum + (results[idx].status === "passed" ? r.weight : 0);
  }, 0);
  const score = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  const criticalsOk = results.every((r) => !r.critical || r.status === "passed" || r.status === "skipped");
  const passed = score >= mission.passThreshold && criticalsOk;

  const failed = results.filter((r) => r.status === "failed");
  const ordered = [...failed.filter((r) => r.critical), ...failed.filter((r) => !r.critical)];

  return {
    score,
    passed,
    results,
    feedback: ordered.map((r) => r.feedback!).filter(Boolean),
    suggestions: ordered.map((r) => r.suggestion!).filter(Boolean),
    warnings: bundle.warnings,
  };
}
