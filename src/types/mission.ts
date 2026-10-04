export type CompanyId = "byteforge" | "nexacore";

export type MissionId = "BF-001" | "NC-001";

export type MissionDifficulty = "Beginner" | "Intermediate" | "Advanced";

export type MissionPriority = "Low" | "Medium" | "High" | "Critical";

/**
 * 1 = required files exist, 2 = keywords/config present, 3 = source structure,
 * 4 = required commands/configuration present, 5 = sandboxed execution (not enabled).
 */
export type ValidationLevel = 1 | 2 | 3 | 4 | 5;

/** Regex sources are strings so mission data stays serializable. Matching is case-insensitive unless `flags` is set. */
export type RequirementRule =
  | { kind: "file_exists"; pathPattern: string; contentFallback?: string }
  | { kind: "keywords"; mode: "all" | "any"; keywords: string[]; filePattern?: string }
  | { kind: "pattern"; regex: string; flags?: string; filePattern?: string; minMatches?: number }
  | { kind: "absent"; regex: string; flags?: string; filePattern?: string }
  | { kind: "commands"; mode: "all" | "any"; commands: string[]; filePattern?: string }
  /** Each column entry is a name or a list of acceptable alternative names. */
  | { kind: "sql_table"; table: string; columns: (string | string[])[]; filePattern?: string }
  | { kind: "sandbox"; testId: string };

export type MissionRequirement = {
  id: string;
  label: string;
  level: ValidationLevel;
  weight: number;
  critical?: boolean;
  tags?: string[];
  rule: RequirementRule;
  failFeedback: string;
  suggestion: string;
};

export type ProcedureTopic = {
  id: string;
  label: string;
  /** Regex sources; the topic is covered if any matches the procedure text. */
  patterns: string[];
  missingFeedback: string;
};

export type MissionDefinition = {
  id: MissionId;
  companyId: CompanyId;
  level: number;
  title: string;
  client: string;
  difficulty: MissionDifficulty;
  priority: MissionPriority;
  estimatedTime: string;
  deadline: string;
  brief: string[];
  objectives: string[];
  constraints: string[];
  expectedOutput: string[];
  hints: string[];
  submission: {
    allowedExtensions: string[];
    maxSizeMB: number;
  };
  requirements: MissionRequirement[];
  /** Minimum normalized score (0-100); every `critical` requirement must also pass. */
  passThreshold: number;
  procedure: {
    minWords: number;
    topics: ProcedureTopic[];
  };
};
