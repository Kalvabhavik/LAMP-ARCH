import { describe, expect, it } from "vitest";
import { evaluateRule } from "@/lib/validation/rules";
import type { RequirementRule } from "@/types/mission";

const files = (entries: Record<string, string>) =>
  Object.entries(entries).map(([path, text]) => ({ path, text }));

describe("evaluateRule", () => {
  it("file_exists matches pathPattern and contentFallback", () => {
    const rule: RequirementRule = { kind: "file_exists", pathPattern: "\\.php$", contentFallback: "<\\?php" };
    expect(evaluateRule(rule, files({ "index.php": "x" }))).toBe("passed");
    expect(evaluateRule(rule, files({ "report.md": "code: <?php echo 1" }))).toBe("passed");
    expect(evaluateRule(rule, files({ "x.txt": "nothing" }))).toBe("failed");
  });

  it("keywords honors all/any and case-insensitivity", () => {
    const all: RequirementRule = { kind: "keywords", mode: "all", keywords: ["ErrorLog", "customlog"] };
    const any: RequirementRule = { kind: "keywords", mode: "any", keywords: ["ErrorLog", "nope"] };
    const f = files({ "v.conf": "ERRORLOG /x CustomLog /y" });
    expect(evaluateRule(all, f)).toBe("passed");
    expect(evaluateRule(any, f)).toBe("passed");
    expect(evaluateRule(all, files({ "v.conf": "ErrorLog only" }))).toBe("failed");
  });

  it("pattern honors flags, filePattern and minMatches", () => {
    const rule: RequirementRule = {
      kind: "pattern",
      regex: "servername\\s+\\S+",
      filePattern: "\\.conf$",
      minMatches: 2,
    };
    expect(evaluateRule(rule, files({ "a.conf": "ServerName x\nServerName y", "b.txt": "ServerName z" }))).toBe("passed");
    expect(evaluateRule(rule, files({ "a.conf": "ServerName x" }))).toBe("failed");
  });

  it("absent passes when the pattern is missing but fails on empty bundles", () => {
    const rule: RequirementRule = { kind: "absent", regex: "'root'" };
    expect(evaluateRule(rule, files({ "a.php": "new mysqli('localhost','app','p','d')" }))).toBe("passed");
    expect(evaluateRule(rule, files({ "a.php": "new mysqli('localhost','root','p','d')" }))).toBe("failed");
    expect(evaluateRule(rule, [])).toBe("failed");
  });

  it("commands uses multiline+case-insensitive defaults and all/any", () => {
    const any: RequirementRule = {
      kind: "commands",
      mode: "any",
      commands: ["\\bapt(-get)?\\s+install\\b[^\\n]*apache2"],
    };
    expect(evaluateRule(any, files({ "s.sh": "sudo APT install -y apache2" }))).toBe("passed");
    expect(evaluateRule(any, files({ "s.sh": "echo hi" }))).toBe("failed");
  });

  it("sql_table parses columns with nested parens and backticks", () => {
    const rule: RequirementRule = {
      kind: "sql_table",
      table: "students",
      columns: ["id", "name", "email", "course"],
    };
    const sql = `CREATE TABLE \`students\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100),
      email VARCHAR(150),
      course DECIMAL(10,2),
      KEY idx_name (name)
    );`;
    expect(evaluateRule(rule, files({ "schema.sql": sql }))).toBe("passed");
    expect(evaluateRule(rule, files({ "schema.sql": sql.replace("email", "mail") }))).toBe("failed");
  });

  it("sql_table supports column alternatives and IF NOT EXISTS", () => {
    const rule: RequirementRule = {
      kind: "sql_table",
      table: "users",
      columns: ["id", ["username", "email"], ["password_hash", "password"]],
    };
    const sql = `create table if not exists users (id int primary key, password_hash varchar(255), email varchar(90));`;
    expect(evaluateRule(rule, files({ "s.sql": sql }))).toBe("passed");
  });

  it("sandbox rules are skipped", () => {
    const rule: RequirementRule = { kind: "sandbox", testId: "t1" };
    expect(evaluateRule(rule, files({ "a.txt": "x" }))).toBe("skipped");
  });
});
