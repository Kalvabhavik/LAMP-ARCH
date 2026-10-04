#!/usr/bin/env node
/**
 * Full-flow e2e for LAMP: The Server Quest.
 * Connects to Chrome over CDP (CHROME_CDP, default http://localhost:29229);
 * falls back to launching headless chromium with swiftshader.
 * Requires `next dev` on :3000 (BASE_URL) and the local Supabase stack.
 * Screenshots → ~/plan/shots (SHOTS_DIR to override).
 */
import { chromium } from "playwright-core";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? join(homedir(), "plan", "shots");
const REPO = new URL("..", import.meta.url).pathname;
const WORK = mkdtempSync(join(tmpdir(), "lamp-e2e-"));
mkdirSync(SHOTS, { recursive: true });

const PLAYER_NAME = `Ada Quest ${Date.now() % 10000}`;

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

function makeZips() {
  writeFileSync(join(WORK, "bad-note.txt"), "todo: everything is broken\n");
  execSync(`cd "${WORK}" && zip -q bad.zip bad-note.txt`);
  execSync(`cd "${join(REPO, "docs/samples/BF-001")}" && zip -qr "${WORK}/bf001.zip" .`);
  execSync(`cd "${join(REPO, "docs/samples/NC-001")}" && zip -qr "${WORK}/nc001.zip" .`);
}

async function questState(page) {
  return page.evaluate(() => window.lampQuestDebug?.state() ?? null);
}
async function milestones(page) {
  const s = await questState(page);
  return new Set(s?.state?.milestones ?? []);
}
async function waitFor(page, fn, timeout = 15000, label = "condition") {
  await page.waitForFunction(fn, undefined, { timeout }).catch(() => {
    throw new Error(`Timeout waiting for ${label}`);
  });
}
async function waitMilestone(page, key, timeout = 15000) {
  await page.waitForFunction(
    (k) => (window.lampQuestDebug?.state()?.state?.milestones ?? []).includes(k),
    key,
    { timeout },
  );
}
async function waitForWorld(page) {
  await page.waitForFunction(
    () => document.querySelector("canvas") !== null && !document.body.innerText.includes("Generating mountain valley"),
    undefined,
    { timeout: 40000 },
  );
  await page.waitForTimeout(2200);
}
async function shot(page, name) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
  console.log(`  📸 ${name}.png`);
}
async function teleport(page, x, z) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.evaluate(([x, z]) => window.lampQuestDebug.teleport(x, z), [x, z]);
    const ok = await page
      .waitForFunction(
        ([tx, tz]) => {
          const p = window.lampQuestDebug?.position?.();
          return p && Math.hypot(p.x - tx, p.z - tz) < 1.5;
        },
        [x, z],
        { timeout: 2500 },
      )
      .then(() => true)
      .catch(() => false);
    if (ok) break;
  }
  await page.waitForTimeout(900); // zone tick (500ms) + camera settle
}
async function pressE(page) {
  await page.keyboard.press("e");
  await page.waitForTimeout(600);
}
async function reloadAndAssert(page, checkFn, label) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitFor(page, () => window.lampQuestDebug?.state()?.status === "ready", 20000, `${label}: world ready`);
  await page.waitForTimeout(600);
  await checkFn();
}

async function main() {
  makeZips();
  let browser;
  try {
    browser = await chromium.connectOverCDP(process.env.CHROME_CDP ?? "http://localhost:29229");
  } catch {
    browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--no-sandbox"] });
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror] ${e.message}`));

  // ---- landing
  console.log("== Landing ==");
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await shot(page, "01-landing");
  check("hero title", await page.locator("text=LAMP: The").count() > 0);

  // ---- register
  console.log("== Register ==");
  await page.goto(`${BASE_URL}/register`, { waitUntil: "domcontentloaded" });
  await waitFor(page, () => document.querySelector("#name") !== null, 15000, "register form");
  await page.fill("#name", PLAYER_NAME);
  await page.waitForTimeout(800);
  await shot(page, "02-register-female");
  await page.click("button:has-text('Male')");
  await page.waitForTimeout(800);
  await shot(page, "03-register-male");
  await page.click("button:has-text('Female')");
  await page.click("button:has-text('Enter the world')");
  await waitFor(page, () => window.lampQuestDebug?.state()?.status === "ready", 30000, "world ready");
  await waitForWorld(page);
  await page.waitForTimeout(700);
  await shot(page, "04-world-spawn");
  await shot(page, "hub-board-front");
  check("registered", (await questState(page))?.state?.player?.name === PLAYER_NAME);

  await reloadAndAssert(page, async () => {
    const s = await questState(page);
    check("reload: player restored", s?.state?.player?.name === PLAYER_NAME);
    check("reload: welcome back toast", (s?.toasts ?? []).some((t) => t.text.includes("Welcome back")));
  }, "after-register");

  // ---- house
  console.log("== House ==");
  await teleport(page, 0, 14);
  await shot(page, "05-house-exterior");
  await teleport(page, 0, 19.4);
  await waitMilestone(page, "entered_home");
  check("entered_home milestone", (await milestones(page)).has("entered_home"));
  await shot(page, "06-house-interior");

  // ---- magic box
  console.log("== Magic Box ==");
  await teleport(page, 3.6, 23.6);
  await shot(page, "07-magic-box-room");
  await pressE(page);
  await page.waitForTimeout(800);
  check("magic box overlay", await page.locator("text=The Magic Box").count() > 0);
  await shot(page, "08-magic-box-open");
  await waitMilestone(page, "found_magic_box");
  await page.click("button:has-text('Open Mission')");
  try {
    await waitFor(page, () => location.pathname.includes("/portal"), 30000, "portal nav");
  } catch { /* fall through to check */ }
  check("portal reached", page.url().includes("/portal"));
  await shot(page, "09-portal");
  await page.goto(`${BASE_URL}/play`, { waitUntil: "domcontentloaded" });
  await waitFor(page, () => window.lampQuestDebug?.state()?.status === "ready", 20000, "return to play");
  check("found_magic_box persisted", (await milestones(page)).has("found_magic_box"));

  // ---- intro hub
  console.log("== Introduction Hub ==");
  await teleport(page, 0, 4);
  await waitMilestone(page, "visited_intro_hub");
  await page.waitForTimeout(800);
  await shot(page, "10-hub-intro");
  check("hub_intro overlay", await page.locator("text=Welcome to the Server Quest").count() > 0);
  await page.click("button:has-text('Head to ByteForge')");
  await page.waitForTimeout(400);

  const leaderboardToggle = page.locator("section").filter({ hasText: "Leaderboard" }).getByRole("button");
  check("leaderboard collapsed by default", await leaderboardToggle.getAttribute("aria-expanded") === "false");
  await page.keyboard.press("l");
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll("section button")).some((button) =>
      button.textContent?.includes("Leaderboard") && button.getAttribute("aria-expanded") === "true",
    ),
  );
  await page.waitForTimeout(500);
  await shot(page, "leaderboard-expanded");
  await page.keyboard.press("l");

  // Training station popup, opened by E while standing on the Linux pad.
  await teleport(page, -8, -8);
  await pressE(page);
  const siteDialog = page.getByRole("dialog", { name: "Linux training page" });
  await siteDialog.waitFor();
  const emptyPage = await siteDialog.getByText("No page linked yet").count();
  if (emptyPage) {
    check("station E interaction shows empty page placeholder", true);
    await shot(page, "station-popup-empty-placeholder");
  } else {
    check("station E interaction shows linked page iframe", await siteDialog.locator("iframe[title='Linux']").count() === 1);
    await siteDialog.locator("iframe[title='Linux']").waitFor();
    await siteDialog.getByText("Loading webpage…", { exact: true }).waitFor({ state: "detached", timeout: 15000 });
    await shot(page, "station-popup-linked");
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"][aria-label="Linux training page"]'));
  check("Escape closes station popup", true);

  // info kiosk
  await teleport(page, -5.5, -4.5);
  await pressE(page);
  check("kiosk info overlay", await page.locator("text=Info kiosk").count() > 0);
  await shot(page, "11-kiosk-info");
  await page.keyboard.press("Escape");
  await page.click("button[aria-label='Close']").catch(() => {});

  // ---- byteforge
  console.log("== ByteForge ==");
  await teleport(page, -29, 2);
  await shot(page, "12-byteforge-exterior");
  await teleport(page, -36, 0);
  await waitMilestone(page, "company:byteforge:joined");
  check("byteforge joined", (await milestones(page)).has("company:byteforge:joined"));
  await teleport(page, -39.4, -1);
  await page.waitForTimeout(600);
  await pressE(page);
  await page.waitForTimeout(1200);
  await page.click("div[role='dialog']"); // skip typewriter
  await page.waitForTimeout(500);
  await shot(page, "13-byteforge-dialogue");
  check("dialogue visible", await page.locator("text=Alex Morgan").count() > 0);
  await page.click("button:has-text(\"I'll take it\")");
  await waitFor(page, () => document.body.innerText.includes("TICKET BF-001"), 10000, "briefing");
  await shot(page, "14-briefing-brief");
  check("BF-001 accepted", (await milestones(page)).has("mission:BF-001:accepted"));
  await page.click("button:has-text('Requirements')");
  await shot(page, "15-briefing-requirements");
  await page.click("button:has-text('Hints')");
  await shot(page, "16-briefing-hints");

  // bad submission
  await page.click("button:has-text('Submit')");
  await page.setInputFiles("input[type=file]", join(WORK, "bad.zip"));
  await page.click("button:has-text('Submit for review')");
  await waitFor(page, () => document.body.innerText.includes("NEEDS IMPROVEMENT"), 20000, "failed result");
  await shot(page, "17-submission-failed");
  check("needs_improvement shown", await page.locator("text=NEEDS IMPROVEMENT").count() > 0);

  // good submission
  await page.click("button:has-text('Resubmit')");
  await page.setInputFiles("input[type=file]", join(WORK, "bf001.zip"));
  await page.click("button:has-text('Submit for review')");
  await waitFor(page, () => document.body.innerText.includes("PASSED"), 30000, "passed result");
  await shot(page, "18-submission-passed");
  await waitMilestone(page, "mission:BF-001:passed");
  await page.click("button[aria-label='Close']");
  await page.waitForTimeout(600);
  check("celebration shown", await page.locator("text=MISSION COMPLETE").count() > 0);
  await shot(page, "19-celebration");
  await page.click("button:has-text('Continue')");

  // procedure
  await page.evaluate(() => window.lampQuestDebug.state().openOverlay("briefing", { missionId: "BF-001", tab: "procedure" }));
  await page.waitForTimeout(500);
  await page.click("button:has-text('Upload .md')");
  await page.setInputFiles("input[type=file][accept*='.md']", join(REPO, "docs/samples/BF-001/PROCEDURE.md"));
  await waitFor(page, () => document.body.innerText.includes("ACCEPTED"), 20000, "procedure result");
  await shot(page, "20-procedure-result");
  await waitMilestone(page, "mission:BF-001:documented");
  await page.click("button[aria-label='Close']");
  await page.waitForTimeout(600);
  await shot(page, "21-ticket-closed");
  await page.click("button:has-text('Continue')").catch(() => {});

  await reloadAndAssert(page, async () => {
    const m = await milestones(page);
    check("reload: BF-001 documented persisted", m.has("mission:BF-001:documented"));
    check("reload: nexacore unlocked", m.has("company:nexacore:unlocked"));
  }, "after-bf001");

  // ---- nexacore
  console.log("== NexaCore ==");
  await teleport(page, 29, -4);
  await shot(page, "22-nexacore-unlocked");
  await teleport(page, 38, -4);
  await waitMilestone(page, "company:nexacore:joined");
  await teleport(page, 42, -4);
  await page.waitForTimeout(600);
  await pressE(page);
  await page.waitForTimeout(1200);
  await page.click("div[role='dialog']");
  await page.waitForTimeout(400);
  await shot(page, "23-nexacore-dialogue");
  check("priya dialogue", await page.locator("text=Priya Nair").count() > 0);
  await page.click("button:has-text(\"I'll take it\")");
  await waitFor(page, () => document.body.innerText.includes("TICKET NC-001"), 10000, "nc briefing");
  await page.click("button:has-text('Submit')");
  await page.setInputFiles("input[type=file]", join(WORK, "nc001.zip"));
  await page.click("button:has-text('Submit for review')");
  await waitFor(page, () => document.body.innerText.includes("PASSED"), 30000, "nc passed");
  await shot(page, "24-nc-submission-passed");
  await waitMilestone(page, "mission:NC-001:passed");
  await page.click("button[aria-label='Close']");
  await page.waitForTimeout(500);
  await page.click("button:has-text('Continue')").catch(() => {});
  await page.evaluate(() => window.lampQuestDebug.state().openOverlay("briefing", { missionId: "NC-001", tab: "procedure" }));
  await page.waitForTimeout(500);
  await page.click("button:has-text('Upload .md')");
  await page.setInputFiles("input[type=file][accept*='.md']", join(REPO, "docs/samples/NC-001/PROCEDURE.md"));
  await waitFor(page, () => document.body.innerText.includes("ACCEPTED"), 20000, "nc procedure");
  await shot(page, "25-nc-procedure-result");
  await page.click("button[aria-label='Close']");
  await page.waitForTimeout(800);
  await shot(page, "26-completion");
  check("game completed", (await milestones(page)).has("game:completed"));
  check("completion certificate", await page.locator("text=Certificate of completion").count() > 0);

  await reloadAndAssert(page, async () => {
    const s = await questState(page);
    check("reload: game completed persisted", (s?.state?.milestones ?? []).includes("game:completed"));
    check("reload: final score > 1500", (s?.state?.player?.score ?? 0) > 1500);
  }, "after-completion");
  await shot(page, "27-world-complete");

  // 1024×768 layout check — objective banner must not overlap the station strip.
  const backBtn = page.locator("button:has-text('Back to world')");
  if (await backBtn.count()) { await backBtn.click(); await page.waitForTimeout(600); }
  await page.setViewportSize({ width: 1024, height: 768 });
  await teleport(page, 0, 8);
  const closeBtn = page.locator("button[aria-label='Close']");
  if (await closeBtn.count()) { await closeBtn.click(); }
  await page.waitForTimeout(800);
  await shot(page, "28-viewport-1024");

  const final = await questState(page);
  console.log(`\nFinal score: ${final?.state?.player?.score}  achievements: ${(final?.state?.achievements ?? []).map((a) => a.key).join(", ")}`);
  console.log(`\n${passed} checks passed, ${failed} failed`);
  await context.close();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("E2E failed:", e.message);
  process.exit(1);
});
