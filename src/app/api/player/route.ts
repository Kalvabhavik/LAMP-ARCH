import { NextResponse } from "next/server";
import { requirePlayer, requireUser } from "@/lib/supabase/server";
import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { buildGameState, type GameEvent } from "@/lib/game/state";
import { loadMilestones, recordMilestones, grantAchievement } from "@/lib/game/mutations";
import { MILESTONE } from "@/lib/game/progression";

export const runtime = "nodejs";

const NAME_RE = /^[\p{L}\p{N} .'-]+$/u;

function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const GET = withErrors(async (request: Request) => {
  const { supabase, user } = await requirePlayer(request);
  await supabase.from("players").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
  return okJson({ state: await buildGameState(supabase, user.id), events: [] });
});

export const POST = withErrors(async (request: Request) => {
  const { supabase, user } = await requireUser(request);

  const existing = await supabase.from("players").select("id").eq("id", user.id).maybeSingle();
  if (existing.data) {
    return okJson({ state: await buildGameState(supabase, user.id), events: [] });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: unknown; gender?: unknown };
  const name = sanitizeName(body.name);
  if (!name || name.length > 40 || !NAME_RE.test(name)) {
    throw new ApiError(400, "INVALID_NAME", "Name must be 1–40 characters: letters, digits, spaces, . ' -.");
  }
  if (body.gender !== "male" && body.gender !== "female") {
    throw new ApiError(400, "INVALID_GENDER", "Gender must be 'male' or 'female'.");
  }

  const { error } = await supabase.from("players").insert({
    id: user.id,
    name,
    gender: body.gender,
    current_level: 1,
    current_location: "home",
  });
  if (error) throw new ApiError(500, "DB_ERROR", "Failed to create player.");

  const milestones = await loadMilestones(supabase, user.id);
  const events: GameEvent[] = await recordMilestones(supabase, user.id, milestones, [MILESTONE.registered], {
    level: 1,
    location: "home",
  });
  const firstStep = await grantAchievement(supabase, user.id, "first_step");
  if (firstStep) events.push(firstStep);

  const state = await buildGameState(supabase, user.id);
  return NextResponse.json({ ok: true, state, events }, { status: 201 });
});

