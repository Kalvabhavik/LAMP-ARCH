import { requirePlayer, submissionsBucket } from "@/lib/supabase/server";
import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { buildGameState, type GameEvent } from "@/lib/game/state";
import { loadMilestones, recordMilestone, recordMilestones, awardScore, grantAchievement, syncPlayer } from "@/lib/game/mutations";
import { MILESTONE } from "@/lib/game/progression";
import { getQuestMission } from "@/content/quest/missions";
import { extractBundle, BundleError } from "@/lib/validation/extract";
import { validateSubmission, type ValidationResult } from "@/lib/validation/engine";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ missionId: string }> };

const MAX_SUBMISSIONS_PER_HOUR = 20;

function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return base.replace(/[^\w. -]/g, "_").slice(0, 120) || "upload";
}

export const POST = withErrors<Ctx>(async (request: Request, ctx: Ctx) => {
  const { missionId } = await ctx.params;
  const { supabase, user, player } = await requirePlayer(request);
  const mission = getQuestMission(decodeURIComponent(missionId));
  if (!mission) throw new ApiError(404, "UNKNOWN_MISSION", `Unknown mission "${missionId}".`);

  const milestones = await loadMilestones(supabase, user.id);
  if (!milestones.has(MILESTONE.missionAccepted(mission.id))) {
    throw new ApiError(403, "MISSION_NOT_ACCEPTED", "Accept the mission first.");
  }
  if (milestones.has(MILESTONE.missionPassed(mission.id))) {
    throw new ApiError(409, "ALREADY_PASSED", "This mission is already passed.");
  }

  // Rate limit: max 20 submissions per player per hour.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("player_id", user.id)
    .gte("submitted_at", since);
  if ((recentCount ?? 0) >= MAX_SUBMISSIONS_PER_HOUR) {
    throw new ApiError(429, "RATE_LIMITED", "Too many submissions — try again later.");
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "NO_FILE", "Multipart form must include a `file` field.");
  if (file.size === 0) throw new ApiError(400, "EMPTY_FILE", "The uploaded file is empty.");
  if (file.size > mission.submission.maxSizeMB * 1024 * 1024) {
    throw new ApiError(413, "FILE_TOO_LARGE", `File exceeds the ${mission.submission.maxSizeMB} MB limit.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Insert the submission row first so the attempt number is reserved.
  const { data: prev } = await supabase
    .from("submissions")
    .select("attempt")
    .eq("player_id", user.id)
    .eq("mission_id", mission.id)
    .order("attempt", { ascending: false })
    .limit(1);
  const attempt = ((prev?.[0]?.attempt as number | undefined) ?? 0) + 1;

  const { data: row, error: insertErr } = await supabase
    .from("submissions")
    .insert({
      player_id: user.id,
      mission_id: mission.id,
      attempt,
      file_name: sanitizeFilename(file.name),
      file_size: file.size,
      mime_type: file.type || null,
      status: "checking",
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new ApiError(500, "DB_ERROR", "Failed to record the submission.");
  const submissionId = row.id as string;

  // Upload the raw bytes to private storage; an upload failure fails the request.
  const objectPath = `${user.id}/${mission.id}/${submissionId}/${sanitizeFilename(file.name)}`;
  const { error: storageErr } = await supabase.storage
    .from(submissionsBucket())
    .upload(objectPath, bytes, { contentType: file.type || "application/octet-stream" });
  if (storageErr) {
    await supabase
      .from("submissions")
      .update({ status: "error", feedback: { reason: "storage" }, checked_at: new Date().toISOString() })
      .eq("id", submissionId);
    throw new ApiError(503, "STORAGE_UNAVAILABLE", "Submission storage is unavailable.");
  }
  await supabase.from("submissions").update({ file_url: objectPath }).eq("id", submissionId);

  const fail = async (status: string, feedback: Record<string, unknown>, httpError: ApiError): Promise<never> => {
    await supabase
      .from("submissions")
      .update({ status, feedback, checked_at: new Date().toISOString() })
      .eq("id", submissionId);
    throw httpError;
  };

  let result: ValidationResult;
  try {
    const bundle = await extractBundle(file.name, bytes, mission.submission.allowedExtensions);
    result = validateSubmission(mission, bundle);
  } catch (err) {
    if (err instanceof BundleError && err.code === "INVALID_FILE_TYPE") {
      return await fail("error", { reason: err.message }, new ApiError(415, "INVALID_FILE_TYPE", err.message));
    }
    return await fail(
      "error",
      { reason: err instanceof Error ? err.message : "Extraction failed" },
      new ApiError(422, "VALIDATION_FAILED", "The submission could not be validated."),
    );
  }

  const events: GameEvent[] = [];
  const gameCtx = { level: player.current_level, location: player.current_location };

  if (result.passed) {
    await supabase
      .from("submissions")
      .update({ status: "passed", score: result.score, feedback: result, checked_at: new Date().toISOString() })
      .eq("id", submissionId);

    // Award only when the passed milestone is genuinely new — prevents double
    // scoring from concurrent or duplicate submissions.
    const passedKey = MILESTONE.missionPassed(mission.id);
    const isNew = await recordMilestone(supabase, user.id, passedKey, gameCtx);
    if (isNew) {
      milestones.add(passedKey);
      events.push({ type: "milestone", key: passedKey });

      events.push(await awardScore(supabase, user.id, "missionCompleted", mission.id));
      if (result.score === 100) events.push(await awardScore(supabase, user.id, "correctImplementation", mission.id));
      const { count: hintCount } = await supabase
        .from("hint_unlocks")
        .select("hint_index", { count: "exact", head: true })
        .eq("player_id", user.id)
        .eq("mission_id", mission.id);
      if ((hintCount ?? 0) === 0) events.push(await awardScore(supabase, user.id, "noHints", mission.id));
      if (attempt === 1) events.push(await awardScore(supabase, user.id, "firstSubmissionSuccess", mission.id));

      const lampOrProd = mission.id === "BF-001" ? "lamp_builder" : "production_ready";
      const a1 = await grantAchievement(supabase, user.id, lampOrProd);
      if (a1) events.push(a1);

      // linux_engineer: first submission where every `linux`-tagged requirement passed.
      const linuxOk = result.results.every(
        (r) =>
          r.status === "passed" ||
          !mission.requirements.find((req) => req.id === r.id)?.tags?.includes("linux"),
      );
      if (linuxOk) {
        const a2 = await grantAchievement(supabase, user.id, "linux_engineer");
        if (a2) events.push(a2);
      }
    }
    // Cascade any implied milestones either way.
    events.push(...(await recordMilestones(supabase, user.id, milestones, [], gameCtx)));
  } else {
    await supabase
      .from("submissions")
      .update({
        status: "needs_improvement",
        score: result.score,
        feedback: result,
        checked_at: new Date().toISOString(),
      })
      .eq("id", submissionId);
    events.push(await awardScore(supabase, user.id, "failedSubmission", mission.id));
  }

  await syncPlayer(supabase, user.id, milestones);
  const { data: submission } = await supabase.from("submissions").select("*").eq("id", submissionId).single();
  return okJson({
    state: await buildGameState(supabase, user.id),
    events,
    result,
    submission,
  });
});
