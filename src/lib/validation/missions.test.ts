import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { zipSync } from "fflate";
import { BF_001 } from "@/content/quest/missions/bf-001";
import { NC_001 } from "@/content/quest/missions/nc-001";
import { extractBundle } from "@/lib/validation/extract";
import { validateSubmission } from "@/lib/validation/engine";
import { reviewProcedure } from "@/lib/validation/procedure";

const SAMPLES = join(process.cwd(), "docs", "samples");

function loadSampleBundle(dir: string) {
  const files = readdirSync(join(SAMPLES, dir)).map((name) => ({
    path: name,
    text: readFileSync(join(SAMPLES, dir, name), "utf-8"),
  }));
  return { files, warnings: [] };
}

describe("BF-001 reference solution", () => {
  it("scores 100 and passes", () => {
    const result = validateSubmission(BF_001, loadSampleBundle("BF-001"));
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.results.every((r) => r.status === "passed")).toBe(true);
  });

  it("also validates when zipped", async () => {
    const entries: Record<string, Uint8Array> = {};
    for (const f of readdirSync(join(SAMPLES, "BF-001"))) {
      entries[f] = new Uint8Array(readFileSync(join(SAMPLES, "BF-001", f)));
    }
    const bundle = await extractBundle("bf-001.zip", zipSync(entries));
    const result = validateSubmission(BF_001, bundle);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("fails the critical students-table requirement when the table is removed", () => {
    const bundle = loadSampleBundle("BF-001");
    // Drop the schema file and neutralize the CREATE TABLE quoted in PROCEDURE.md.
    bundle.files = bundle.files.filter((f) => f.path !== "schema.sql");
    for (const f of bundle.files) f.text = f.text.replace(/CREATE TABLE/gi, "MAKE TABLE");
    bundle.files.push({ path: "schema.sql", text: "CREATE DATABASE student_portal;" });
    const result = validateSubmission(BF_001, bundle);
    const students = result.results.find((r) => r.id === "students-table");
    expect(students?.status).toBe("failed");
    expect(result.passed).toBe(false);
    expect(result.score).toBeLessThan(100);
  });

  it("reference procedure is accepted and complete", () => {
    const text = readFileSync(join(SAMPLES, "BF-001", "PROCEDURE.md"), "utf-8");
    const review = reviewProcedure(BF_001, text);
    expect(review.accepted).toBe(true);
    expect(review.complete).toBe(true);
    expect(review.score).toBe(100);
  });
});

describe("NC-001 reference solution", () => {
  it("scores 100 and passes", () => {
    const result = validateSubmission(NC_001, loadSampleBundle("NC-001"));
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.results.every((r) => r.status === "passed")).toBe(true);
  });

  it("fails when the users table loses password_hash", () => {
    const bundle = loadSampleBundle("NC-001");
    const schema = bundle.files.find((f) => f.path === "schema.sql")!;
    schema.text = schema.text.replace("password_hash", "pw");
    // PROCEDURE.md mentions the schema in prose; neutralize its CREATE TABLE too.
    for (const f of bundle.files) f.text = f.text.replace(/CREATE TABLE/gi, "MAKE TABLE");
    const result = validateSubmission(NC_001, bundle);
    expect(result.results.find((r) => r.id === "users-table")?.status).toBe("failed");
    expect(result.passed).toBe(false);
  });

  it("reference procedure is accepted and complete", () => {
    const text = readFileSync(join(SAMPLES, "NC-001", "PROCEDURE.md"), "utf-8");
    const review = reviewProcedure(NC_001, text);
    expect(review.accepted).toBe(true);
    expect(review.complete).toBe(true);
    expect(review.score).toBe(100);
  });
});

describe("reviewProcedure negative cases", () => {
  it("rejects a thin procedure with useful feedback", () => {
    const review = reviewProcedure(BF_001, "I installed apache and made a php page. Done.");
    expect(review.accepted).toBe(false);
    expect(review.complete).toBe(false);
    expect(review.feedback.length).toBeGreaterThan(0);
  });

  it("marks sections mentioned-but-not-headed", () => {
    const text = [
      "## Objective",
      "Deploy the portal. " + "word ".repeat(160),
      "I did the testing and configuration and installation and implementation together with the environment setup and all problems and solutions and the final result.",
      "commands: sudo apt install apache2 php mariadb-server",
      "DocumentRoot /var/www/html, create database, create table, mysqli index.php",
    ].join("\n");
    const review = reviewProcedure(BF_001, text);
    const mentioned = review.sections.filter((s) => s.status === "mentioned");
    expect(mentioned.length).toBeGreaterThan(0);
    expect(review.feedback.some((f) => f.startsWith('Give "'))).toBe(true);
  });
});
