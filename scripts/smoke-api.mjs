/**
 * End-to-end smoke test for the Server Quest API.
 * Requires: local Supabase (npx supabase start), the migration applied,
 * .env.local populated, and `next dev` (or `next start`) running.
 *
 * Usage: node scripts/smoke-api.mjs [baseUrl]   (default http://127.0.0.1:3000)
 */
import { createClient } from "@supabase/supabase-js";
import { zipSync } from "fflate";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";

function loadEnv(file) {
  const env = {};
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const m = /^([A-Z_]+)="?(.*?)"?\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
const env = loadEnv(new URL("../.env.local", import.meta.url).pathname);
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPA_URL || !ANON) throw new Error("missing supabase env in .env.local");

let failures = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  if (!cond) failures++;
}

// --- auth: anonymous sign-in
const supabase = createClient(SUPA_URL, ANON);
const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
if (authErr) throw authErr;
const token = auth.session.access_token;
const uid = auth.user.id;
console.log("anonymous user:", uid);

const api = async (path, { method = "GET", body, form } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

// --- health
const health = await api("/health");
check("GET /api/health ok", health.json?.ok && health.json?.supabase === "ok");

// --- create player
const created = await api("/player", { method: "POST", body: { name: "Smoke Tester", gender: "female" } });
check("POST /api/player creates", [200, 201].includes(created.status) && created.json?.state?.player?.name === "Smoke Tester");
check("registered milestone", created.json?.state?.milestones?.includes("registered"));
check("first_step achievement", created.json?.events?.some((e) => e.key === "first_step"));

// --- milestones
for (const m of ["entered_home", "found_magic_box", "visited_intro_hub"]) {
  const r = await api("/progress", { method: "POST", body: { type: "milestone", milestone: m } });
  check(`milestone ${m}`, r.status === 200 && r.json?.ok);
}

// --- idempotency: re-post found_magic_box → no second explorer achievement event
const repost1 = await api("/progress", { method: "POST", body: { type: "milestone", milestone: "found_magic_box" } });
const repost2 = await api("/progress", { method: "POST", body: { type: "milestone", milestone: "found_magic_box" } });
const explorerEvents = [repost1, repost2].flatMap((r) => r.json?.events ?? []).filter((e) => e.key === "explorer").length;
check("re-posting found_magic_box emits no duplicate explorer event", explorerEvents === 0);
const { data: achRows } = await supabase.from("achievements").select("achievement_key").eq("achievement_key", "explorer");
check("exactly one explorer achievement row", (achRows ?? []).length === 1);

// --- join byteforge / nexacore locked
const joinBf = await api("/progress", { method: "POST", body: { type: "milestone", milestone: "company:byteforge:joined" } });
check("company:byteforge:joined", joinBf.status === 200 && joinBf.json?.state?.milestones?.includes("company:byteforge:joined"));
const joinNcEarly = await api("/progress", { method: "POST", body: { type: "milestone", milestone: "company:nexacore:joined" } });
check("company:nexacore:joined rejected (403)", joinNcEarly.status === 403 && joinNcEarly.json?.error?.code === "MILESTONE_LOCKED");

// --- accept BF-001
const acceptBf = await api("/missions/BF-001/accept", { method: "POST" });
check("accept BF-001", acceptBf.status === 200 && acceptBf.json?.state?.milestones?.includes("mission:BF-001:accepted"));

// --- hint idempotency: revealing hint 0 twice charges −50 only once
const h1 = await api("/progress", { method: "POST", body: { type: "hint", missionId: "BF-001", hintIndex: 0 } });
const h2 = await api("/progress", { method: "POST", body: { type: "hint", missionId: "BF-001", hintIndex: 0 } });
const hintCharges = [h1, h2].flatMap((r) => r.json?.events ?? []).filter((e) => e.type === "score" && e.delta === -50).length;
check("same hint twice → −50 charged once", hintCharges === 1);

// --- bad submission → needs_improvement, −25
const badForm = new FormData();
badForm.set("file", new Blob([zipSync({ "readme.txt": new TextEncoder().encode("nothing here") })], { type: "application/zip" }), "bad.zip");
const bad = await api("/missions/BF-001/submissions", { method: "POST", form: badForm });
check("bad zip → needs_improvement", bad.status === 200 && bad.json?.submission?.status === "needs_improvement", `score=${bad.json?.result?.score}`);
check("failedSubmission −25 event", bad.json?.events?.some((e) => e.type === "score" && e.delta === -25));

// --- good submission (docs/samples/BF-001 zip)
const bfEntries = {};
for (const f of readdirSync("docs/samples/BF-001")) bfEntries[f] = new Uint8Array(readFileSync(join("docs/samples/BF-001", f)));
// --- concurrent double submission of the passing zip: scoring awarded once
const dupForm = () => {
  const f = new FormData();
  f.set("file", new Blob([zipSync(bfEntries)], { type: "application/zip" }), "bf-001.zip");
  return f;
};
const [c1, c2] = await Promise.all([
  api("/missions/BF-001/submissions", { method: "POST", form: dupForm() }),
  api("/missions/BF-001/submissions", { method: "POST", form: dupForm() }),
]);
const concurrentPassed = [c1, c2].filter((r) => r.status === 200 && r.json?.submission?.status === "passed").length;
check("concurrent double submission: at least one passed", concurrentPassed >= 1, `statuses=${c1.status},${c2.status}`);
const { data: mcEvents } = await supabase.from("score_events").select("id").eq("reason", "missionCompleted").eq("mission_id", "BF-001");
check("missionCompleted awarded exactly once", (mcEvents ?? []).length === 1, `count=${(mcEvents ?? []).length}`);
const good = c1.json?.submission?.status === "passed" ? c1 : c2;
check("BF-001 zip → passed", good.json?.submission?.status === "passed", `score=${good.json?.result?.score}`);
check("BF-001 score 100", good.json?.result?.score === 100);
check("mission:BF-001:passed milestone", good.json?.state?.milestones?.includes("mission:BF-001:passed"));
check("lamp_builder achievement", good.json?.state?.achievements?.some((a) => a.key === "lamp_builder") || good.json?.events?.some((e) => e.key === "lamp_builder"));

// --- resubmit after pass → 409
const resub = new FormData();
resub.set("file", new Blob([zipSync(bfEntries)], { type: "application/zip" }), "bf-001.zip");
const resubmit = await api("/missions/BF-001/submissions", { method: "POST", form: resub });
check("resubmit after pass → 409 ALREADY_PASSED", resubmit.status === 409 && resubmit.json?.error?.code === "ALREADY_PASSED");

// --- procedure BF-001 (markdown text)
const bfProc = readFileSync("docs/samples/BF-001/PROCEDURE.md", "utf-8");
const procForm = new FormData();
procForm.set("text", bfProc);
procForm.set("format", "markdown");
const proc = await api("/missions/BF-001/procedure", { method: "POST", form: procForm });
check("BF-001 procedure accepted", proc.status === 200 && proc.json?.review?.accepted, `score=${proc.json?.review?.score} complete=${proc.json?.review?.complete}`);
check("documentation_master achievement", proc.json?.events?.some((e) => e.key === "documentation_master"));
const midState = proc.json?.state;
check("company:byteforge:completed", midState?.milestones?.includes("company:byteforge:completed"));
check("company:nexacore:unlocked", midState?.milestones?.includes("company:nexacore:unlocked"));

// --- join nexacore, accept + pass NC-001, procedure
const joinNc = await api("/progress", { method: "POST", body: { type: "milestone", milestone: "company:nexacore:joined" } });
check("company:nexacore:joined now works", joinNc.status === 200);
const acceptNc = await api("/missions/NC-001/accept", { method: "POST" });
check("accept NC-001", acceptNc.status === 200);

const ncEntries = {};
for (const f of readdirSync("docs/samples/NC-001")) ncEntries[f] = new Uint8Array(readFileSync(join("docs/samples/NC-001", f)));
const ncForm = new FormData();
ncForm.set("file", new Blob([zipSync(ncEntries)], { type: "application/zip" }), "nc-001.zip");
const nc = await api("/missions/NC-001/submissions", { method: "POST", form: ncForm });
check("NC-001 zip → passed", nc.status === 200 && nc.json?.submission?.status === "passed", `score=${nc.json?.result?.score}`);
check("production_ready achievement", nc.json?.events?.some((e) => e.key === "production_ready"));

const ncProcForm = new FormData();
ncProcForm.set("text", readFileSync("docs/samples/NC-001/PROCEDURE.md", "utf-8"));
ncProcForm.set("format", "markdown");
const ncProc = await api("/missions/NC-001/procedure", { method: "POST", form: ncProcForm });
check("NC-001 procedure accepted", ncProc.status === 200 && ncProc.json?.review?.accepted, `score=${ncProc.json?.review?.score}`);
check("game:completed", ncProc.json?.state?.milestones?.includes("game:completed"));
check("server_quest_champion achievement", ncProc.json?.state?.achievements?.some((a) => a.key === "server_quest_champion"));

const finalState = ncProc.json?.state;
console.log("\nFinal score:", finalState?.player?.score);
console.log("Achievements:", (finalState?.achievements ?? []).map((a) => a.key).join(", "));
console.log("Milestones:", (finalState?.milestones ?? []).join(", "));

// --- RLS: direct client writes must fail; only own rows readable
const { error: updErr } = await supabase.from("players").update({ score: 99999 }).eq("id", uid);
const { data: me } = await supabase.from("players").select("score").eq("id", uid).single();
check("RLS: direct score update blocked", me?.score !== 99999, updErr ? `err=${updErr.code}` : "no error but 0 rows");
const { error: insErr } = await supabase.from("achievements").insert({ player_id: uid, achievement_key: "hax", achievement_name: "x", description: "x" });
check("RLS: direct achievement insert blocked", !!insErr, insErr?.code ?? "");

// Another anonymous user must not see our player row.
const other = createClient(SUPA_URL, ANON);
await other.auth.signInAnonymously();
const { data: foreign } = await other.from("players").select("*").eq("id", uid);
check("RLS: other user sees 0 rows for this player", (foreign ?? []).length === 0);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
