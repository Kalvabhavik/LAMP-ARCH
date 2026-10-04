export type ProcedureFormat = "text" | "markdown" | "pdf" | "txt";

export type ProcedureSectionId =
  | "objective"
  | "environment"
  | "installation"
  | "configuration"
  | "implementation"
  | "testing"
  | "problems"
  | "solutions"
  | "final_result";

export type ProcedureSection = {
  id: ProcedureSectionId;
  label: string;
  /** Heading aliases, matched case-insensitively as whole words. */
  aliases: string[];
};

export type SectionStatus = "present" | "mentioned" | "missing";

export type ProcedureReview = {
  score: number;
  accepted: boolean;
  /** All sections present as headings and all mission topics covered. */
  complete: boolean;
  wordCount: number;
  sections: { id: ProcedureSectionId; label: string; status: SectionStatus }[];
  topics: { id: string; label: string; covered: boolean }[];
  feedback: string[];
};
