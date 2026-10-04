import type { ProcedureSection } from "@/types/procedure";

export const PROCEDURE_SECTIONS: ProcedureSection[] = [
  { id: "objective", label: "Objective", aliases: ["objective", "objectives", "goal", "aim", "purpose", "problem statement"] },
  { id: "environment", label: "Environment", aliases: ["environment", "prerequisites", "system setup", "server setup", "setup"] },
  { id: "installation", label: "Installation", aliases: ["installation", "install", "installing", "packages"] },
  { id: "configuration", label: "Configuration", aliases: ["configuration", "config", "configuring", "apache configuration"] },
  { id: "implementation", label: "Implementation", aliases: ["implementation", "development", "php implementation", "code"] },
  { id: "testing", label: "Testing", aliases: ["testing", "tests", "test", "verification"] },
  { id: "problems", label: "Problems", aliases: ["problems", "problems encountered", "issues", "challenges", "errors"] },
  { id: "solutions", label: "Solutions", aliases: ["solutions", "solution", "fixes", "resolution", "how problems were solved"] },
  { id: "final_result", label: "Final result", aliases: ["final result", "result", "results", "outcome", "conclusion"] },
];

/**
 * Scoring (total 100):
 * - each section: 8 points if it appears as a heading ("present"), 4 if only mentioned in body text
 * - length: 8 points when wordCount >= mission.procedure.minWords, 4 when >= half of it
 * - mission topics: 20 points split evenly across topics
 * Accepted when score >= PROCEDURE_ACCEPT_THRESHOLD.
 */
export const PROCEDURE_SECTION_POINTS = { present: 8, mentioned: 4, missing: 0 } as const;
export const PROCEDURE_LENGTH_POINTS = 8;
export const PROCEDURE_TOPIC_POINTS = 20;
export const PROCEDURE_ACCEPT_THRESHOLD = 70;
export const PROCEDURE_MAX_TEXT_CHARS = 100_000;
