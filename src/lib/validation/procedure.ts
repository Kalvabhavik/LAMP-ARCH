import {
  PROCEDURE_SECTIONS,
  PROCEDURE_SECTION_POINTS,
  PROCEDURE_LENGTH_POINTS,
  PROCEDURE_TOPIC_POINTS,
  PROCEDURE_ACCEPT_THRESHOLD,
  PROCEDURE_MAX_TEXT_CHARS,
} from "@/content/quest/procedure-rubric";
import type { MissionDefinition } from "@/types/mission";
import type { ProcedureReview, SectionStatus } from "@/types/procedure";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isHeadingLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const markdown = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(trimmed);
  if (markdown) return markdown[1];
  const bold = /^\*\*(.+?)\*\*\s*:?\s*$/.exec(trimmed);
  if (bold) return bold[1];
  const numbered = /^(?:\d+[.)]|[-*])\s+(.*)$/.exec(trimmed);
  if (numbered && numbered[1].length <= 60) return numbered[1];
  if (trimmed.length <= 60 && trimmed.endsWith(":")) return trimmed.slice(0, -1);
  // Short Title Case / UPPER line with no terminal period.
  if (trimmed.length <= 40 && !/[.!?]$/.test(trimmed)) {
    const words = trimmed.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    if (words.length > 0 && words.every((w) => /^[A-Z0-9]/.test(w))) return trimmed;
  }
  return null;
}

function containsWholeWord(text: string, phrase: string): boolean {
  const re = new RegExp(`\\b${escapeRe(phrase).replace(/\s+/g, "\\s+")}\\b`, "i");
  return re.test(text);
}

export function reviewProcedure(mission: MissionDefinition, rawText: string): ProcedureReview {
  const text = rawText.slice(0, PROCEDURE_MAX_TEXT_CHARS);
  const lines = text.split(/\r?\n/);
  const headings = lines.map(isHeadingLine).filter((h): h is string => h !== null);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const minWords = mission.procedure.minWords;

  const sections = PROCEDURE_SECTIONS.map((section) => {
    let status: SectionStatus = "missing";
    if (section.aliases.some((alias) => headings.some((h) => containsWholeWord(h, alias)))) {
      status = "present";
    } else if (section.aliases.some((alias) => containsWholeWord(text, alias))) {
      status = "mentioned";
    }
    return { id: section.id, label: section.label, status };
  });

  const topics = mission.procedure.topics.map((topic) => ({
    id: topic.id,
    label: topic.label,
    covered: topic.patterns.some((p) => new RegExp(p, "i").test(text)),
  }));

  const sectionScore = sections.reduce((sum, s) => sum + PROCEDURE_SECTION_POINTS[s.status], 0);
  const lengthScore = wordCount >= minWords ? PROCEDURE_LENGTH_POINTS : wordCount >= minWords / 2 ? PROCEDURE_LENGTH_POINTS / 2 : 0;
  const topicScore = topics.length
    ? Math.round((topics.filter((t) => t.covered).length / topics.length) * PROCEDURE_TOPIC_POINTS)
    : PROCEDURE_TOPIC_POINTS;
  const score = Math.min(100, sectionScore + lengthScore + topicScore);

  const complete = sections.every((s) => s.status === "present") && topics.every((t) => t.covered);
  const accepted = score >= PROCEDURE_ACCEPT_THRESHOLD;

  const feedback: string[] = [];
  if (accepted && complete) {
    feedback.push("Excellent documentation — a real engineer's procedure.");
  } else {
    for (const topic of topics.filter((t) => !t.covered)) {
      feedback.push(mission.procedure.topics.find((t) => t.id === topic.id)!.missingFeedback);
    }
    for (const section of sections) {
      if (section.status === "missing") feedback.push(`Add a "${section.label}" section.`);
      else if (section.status === "mentioned") feedback.push(`Give "${section.label}" its own heading.`);
    }
    if (wordCount < minWords) {
      feedback.push(`Your procedure is only ${wordCount} words — aim for at least ${minWords}.`);
    }
  }

  return { score, accepted, complete, wordCount, sections, topics, feedback };
}
