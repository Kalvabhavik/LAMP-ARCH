import { requirePlayer, submissionsBucket } from "@/lib/supabase/server";
import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { buildGameState, type GameEvent } from "@/lib/game/state";
import { loadMilestones, recordMilestone, recordMilestones, awardScore, grantAchievement, syncPlayer } from "@/lib/game/mutations";
import { MILESTONE } from "@/lib/game/progression";
import { getQuestMission } from "@/content/quest/missions";
import { extractBundle, BundleError } from "@/lib/validation/extract";
import { reviewProcedure } from "@/lib/validation/procedure";
import { PROCEDURE_MAX_TEXT_CHARS } from "@/content/quest/procedure-rubric";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ missionId: string }> };

const MAX_PROCEDURE_FILE = 4 * 1024 * 1024;
const PROCEDURE_EXTENSIONS = [".md", ".txt", ".pdf"];

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "procedure";
  return base.replace(/[^\w. -]/g, "_").slice(0, 120) || "procedure";
}

export const POST = withErrors<Ctx>(async (request: Request, ctx: Ctx) => {
  const { missionId } = await ctx.params;
  const { supabase, user, player } = await requirePlayer(request);
  const mission = getQuestMission(decodeURIComponent(missionId));
  if (!mission) throw new ApiError(404, "UNKNOWN_MISSION", `Unknown mission "${missionId}".`);

  const milestones = await loadMilestones(supabase, user.id);
  if (!milestones.has(MILESTONE.missionPassed(mission.id))) {
    throw new ApiError(403, "MISSION_NOT_PASSED", "Pass the mission before submitting a procedure.");
  }
  if (milestones.has(MILESTONE.missionDocumented(mission.id))) {
    throw new ApiError(409, "ALREADY_DOCUMENTED", "A procedure was already accepted for this mission.");
  }

  const form = await request.formData().catch(() => null);
  if (!form) throw new ApiError(400, "BAD_REQUEST", "Expected multipart form data.");

  let text = "";
  let format: "text" | "markdown" | "pdf" | "txt" = "text";
  let fileBytes: Uint8Array | null = null;
  let fileName: string | null = null;

  const file = form.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PROCEDURE_FILE) throw new ApiError(413, "FILE_TOO_LARGE", "Procedure file exceeds 4 MB.");
    fileName = sanitizeFilename(file.name);
    fileBytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractBundle(fileName, fileBytes, PROCEDURE_EXTENSIONS).catch((err: unknown) => {
      if (err instanceof BundleError) throw new ApiError(415, "INVALID_FILE_TYPE", err.message);
      throw new ApiError(422, "EXTRACTION_FAILED", "Could not read the procedure file.");
    });
    text = extracted.files.map((f) => f.text).join("\n");
    const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    format = ext === ".md" ? "markdown" : ext === ".pdf" ? "pdf" : "txt";
  } else {
    const rawText = form.get("text");
    const rawFormat = form.get("format");
    if (typeof rawText !== "string" || !rawText.trim()) {
      throw new ApiError(400, "NO_PROCEDURE", "Provide `text`+`format` or a `file`.");
    }
    if (rawFormat !== "text" && rawFormat !== "markdown") {
      throw new ApiError(400, "INVALID_FORMAT", "format must be 'text' or 'markdown' for inline procedures.");
    }
    text = rawText;
    format = rawFormat;
  }

  if (text.length > PROCEDURE_MAX_TEXT_CHARS) {
    throw new ApiError(413, "PROCEDURE_TOO_LONG", `Procedure text exceeds ${PROCEDURE_MAX_TEXT_CHARS} characters.`);
  }

  const { data: prev } = await supabase
    .from("procedures")
    .select("attempt")
    .eq("player_id", user.id)
    .eq("mission_id", mission.id)
    .order("attempt", { ascending: false })
    .limit(1);
  const attempt = ((prev?.[0]?.attempt as number | undefined) ?? 0) + 1;

  const { data: row, error: insertErr } = await supabase
    .from("procedures")
    .insert({
      player_id: user.id,
      mission_id: mission.id,
      attempt,
      format,
      procedure_text: text.slice(0, PROCEDURE_MAX_TEXT_CHARS),
      file_name: fileName,
      status: "checking",
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new ApiError(500, "DB_ERROR", "Failed to record the procedure.");
  const procedureId = row.id as string;

  // Upload the file before any review/score side effects; failure fails the request.
  if (fileBytes && fileName) {
    const objectPath = `${user.id}/${mission.id}/${procedureId}/${fileName}`;
    const { error: storageErr } = await supabase.storage
      .from(submissionsBucket())
      .upload(objectPath, fileBytes, { contentType: "application/octet-stream" });
    if (storageErr) {
      await supabase
        .from("procedures")
        .update({ status: "error", feedback: { reason: "storage" }, reviewed_at: new Date().toISOString() })
        .eq("id", procedureId);
      throw new ApiError(503, "STORAGE_UNAVAILABLE", "Submission storage is unavailable.");
    }
    await supabase.from("procedures").update({ file_url: objectPath }).eq("id", procedureId);
  }

  const review = reviewProcedure(mission, text);
  await supabase
    .from("procedures")
    .update({
      status: review.accepted ? "accepted" : "needs_improvement",
      score: review.score,
      feedback: review,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", procedureId);

  const events: GameEvent[] = [];
  const gameCtx = { level: player.current_level, location: player.current_location };
  if (review.accepted) {
    // Award only when the documented milestone is genuinely new.
    const documentedKey = MILESTONE.missionDocumented(mission.id);
    const isNew = await recordMilestone(supabase, user.id, documentedKey, gameCtx);
    if (isNew) {
      milestones.add(documentedKey);
      events.push({ type: "milestone", key: documentedKey });
      events.push(await awardScore(supabase, user.id, "goodProcedure", mission.id));
      if (review.complete) {
        const a = await grantAchievement(supabase, user.id, "documentation_master");
        if (a) events.push(a);
      }
    }
    // Cascade company completions / next-company unlock / game completion.
    events.push(...(await recordMilestones(supabase, user.id, milestones, [], gameCtx)));
    if (milestones.has(MILESTONE.gameCompleted)) {
      const a = await grantAchievement(supabase, user.id, "server_quest_champion");
      if (a) events.push(a);
    }
  }

  await syncPlayer(supabase, user.id, milestones);
  return okJson({
    state: await buildGameState(supabase, user.id),
    events,
    review,
    procedureId,
  });
});
