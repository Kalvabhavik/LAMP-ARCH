import type { RequirementRule } from "@/types/mission";
import type { ExtractedFile } from "@/lib/validation/extract";

export interface SandboxRunner {
  run(testId: string, files: ExtractedFile[]): Promise<{ status: "passed" | "failed" | "skipped"; reason?: string }>;
}

/** Sandboxed execution is not enabled; sandbox rules never affect scoring. */
export const disabledSandboxRunner: SandboxRunner = {
  async run() {
    return { status: "skipped", reason: "Sandboxed execution is not enabled" };
  },
};

function scopedFiles(rule: { filePattern?: string }, files: ExtractedFile[]): ExtractedFile[] {
  if (!rule.filePattern) return files;
  const pattern = new RegExp(rule.filePattern, "i");
  return files.filter((f) => pattern.test(f.path));
}

function anyMatch(files: ExtractedFile[], regex: RegExp): boolean {
  return files.some((f) => regex.test(f.text));
}

const SKIP_COLUMN_STARTS = /^(primary|key|unique|constraint|index|foreign|check|fulltext)\b/i;

/** Extract column names from a CREATE TABLE body, splitting on top-level commas. */
function columnsFromBody(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);

  const columns: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || SKIP_COLUMN_STARTS.test(trimmed)) continue;
    const name = /^[`"'\[]?([A-Za-z_]\w*)/.exec(trimmed)?.[1];
    if (name) columns.push(name.toLowerCase());
  }
  return columns;
}

/** Find `CREATE TABLE <name> ( ... )` with balanced parentheses; returns the body text. */
function findTableBody(text: string, table: string): string | null {
  const start = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?[\`"']?${table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\`"']?\\s*\\(`,
    "i",
  ).exec(text);
  if (!start) return null;
  let depth = 1;
  let i = start.index + start[0].length;
  const bodyStart = i;
  for (; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")") {
      depth--;
      if (depth === 0) return text.slice(bodyStart, i);
    }
  }
  return null;
}

function sqlTableOk(rule: Extract<RequirementRule, { kind: "sql_table" }>, files: ExtractedFile[]): boolean {
  for (const file of files) {
    const body = findTableBody(file.text, rule.table);
    if (!body) continue;
    const columns = new Set(columnsFromBody(body));
    const missing = rule.columns.some((col) => {
      const options = Array.isArray(col) ? col : [col];
      return !options.some((c) => columns.has(c.toLowerCase()));
    });
    if (!missing) return true;
  }
  return false;
}

export type RuleStatus = "passed" | "failed" | "skipped";

/** Evaluate a single rule against an extracted bundle. Pure and synchronous. */
export function evaluateRule(rule: RequirementRule, files: ExtractedFile[]): RuleStatus {
  switch (rule.kind) {
    case "file_exists": {
      const pathRe = new RegExp(rule.pathPattern, "i");
      if (files.some((f) => pathRe.test(f.path))) return "passed";
      if (rule.contentFallback && anyMatch(files, new RegExp(rule.contentFallback, "i"))) return "passed";
      return "failed";
    }
    case "keywords": {
      const scoped = scopedFiles(rule, files);
      const haystack = scoped.map((f) => f.text).join("\n").toLowerCase();
      const test = (kw: string) => haystack.includes(kw.toLowerCase());
      return (rule.mode === "all" ? rule.keywords.every(test) : rule.keywords.some(test)) ? "passed" : "failed";
    }
    case "pattern": {
      const scoped = scopedFiles(rule, files);
      const re = new RegExp(rule.regex, rule.flags ?? "i");
      const needed = rule.minMatches ?? 1;
      let matches = 0;
      for (const file of scoped) {
        const globalRe = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
        matches += file.text.match(globalRe)?.length ?? 0;
        if (matches >= needed) return "passed";
      }
      return "failed";
    }
    case "absent": {
      // An empty submission must not earn points for "not containing" something.
      if (files.length === 0) return "failed";
      const scoped = scopedFiles(rule, files);
      if (scoped.length === 0) return "failed";
      const re = new RegExp(rule.regex, rule.flags ?? "i");
      return anyMatch(scoped, re) ? "failed" : "passed";
    }
    case "commands": {
      const scoped = scopedFiles(rule, files);
      const haystack = scoped.map((f) => `${f.path}\n${f.text}`).join("\n");
      const test = (cmd: string) => new RegExp(cmd, "im").test(haystack);
      return (rule.mode === "all" ? rule.commands.every(test) : rule.commands.some(test)) ? "passed" : "failed";
    }
    case "sql_table":
      return sqlTableOk(rule, scopedFiles(rule, files)) ? "passed" : "failed";
    case "sandbox":
      return "skipped";
  }
}
