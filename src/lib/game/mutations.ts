import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS, type AchievementKey } from "@/content/quest/achievements";
import { SCORE_REASON_LABEL, SCORE_RULES, type ScoreReason } from "@/lib/game/scoring";
import { cascadeMilestones, levelFor } from "@/lib/game/progression";
import { ApiError } from "@/lib/api/errors";
import type { GameEvent } from "@/lib/game/state";

export async function loadMilestones(supabase: SupabaseClient, playerId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("game_progress")
    .select("milestone")
    .eq("player_id", playerId)
    .eq("status", "completed");
  return new Set((data ?? []).map((r) => r.milestone as string));
}

/** Insert a milestone (idempotent — existing rows are ignored) and return whether it was new. */
export async function recordMilestone(
  supabase: SupabaseClient,
  playerId: string,
  milestone: string,
  context: { level: number; location: string },
): Promise<boolean> {
  const { data, error } = await supabase
    .from("game_progress")
    .upsert(
      {
        player_id: playerId,
        milestone,
        level: context.level,
        location: context.location,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "player_id,milestone", ignoreDuplicates: true },
    )
    .select("milestone");
  if (error) throw new ApiError(500, "DB_ERROR", "Failed to record progress.");
  return (data?.length ?? 0) === 1;
}

/** Record milestone + cascade; returns GameEvents for every milestone actually added. */
export async function recordMilestones(
  supabase: SupabaseClient,
  playerId: string,
  milestones: Set<string>,
  toAdd: string[],
  context: { level: number; location: string },
): Promise<GameEvent[]> {
  const events: GameEvent[] = [];
  for (const m of toAdd) {
    if (milestones.has(m)) continue;
    if (await recordMilestone(supabase, playerId, m, context)) {
      milestones.add(m);
      events.push({ type: "milestone", key: m });
    }
  }
  // Cascaded unlocks/completions implied by the new set.
  const implied = cascadeMilestones(new Set(milestones)).filter((m) => !milestones.has(m));
  for (const m of implied) {
    if (await recordMilestone(supabase, playerId, m, context)) {
      milestones.add(m);
      events.push({ type: "milestone", key: m });
    }
  }
  return events;
}

export async function grantAchievement(
  supabase: SupabaseClient,
  playerId: string,
  key: AchievementKey,
): Promise<GameEvent | null> {
  const def = ACHIEVEMENTS.find((a) => a.key === key);
  if (!def) return null;
  const { data, error } = await supabase
    .from("achievements")
    .upsert(
      { player_id: playerId, achievement_key: def.key, achievement_name: def.name, description: def.description },
      { onConflict: "player_id,achievement_key", ignoreDuplicates: true },
    )
    .select("achievement_key");
  if (error) throw new ApiError(500, "DB_ERROR", "Failed to record achievement.");
  return (data?.length ?? 0) === 1
    ? { type: "achievement", key: def.key, name: def.name, description: def.description }
    : null;
}

export async function awardScore(
  supabase: SupabaseClient,
  playerId: string,
  reason: ScoreReason,
  missionId?: string,
): Promise<GameEvent> {
  const delta = SCORE_RULES[reason];
  const { error } = await supabase.rpc("award_score", {
    p_player: playerId,
    p_delta: delta,
    p_reason: reason,
    p_mission: missionId ?? null,
  });
  if (error) {
    console.error(`award_score failed: ${error.code}`);
    throw new ApiError(500, "SCORE_ERROR", "Failed to update the score.");
  }
  return { type: "score", delta, reason, label: SCORE_REASON_LABEL[reason] };
}

/** Keep players.current_level / current_location / completed_missions in sync. */
export async function syncPlayer(
  supabase: SupabaseClient,
  playerId: string,
  milestones: Set<string>,
  patch: { current_location?: string } = {},
): Promise<void> {
  const { data: subs } = await supabase
    .from("submissions")
    .select("mission_id")
    .eq("player_id", playerId)
    .eq("status", "passed");
  await supabase
    .from("players")
    .update({
      current_level: levelFor(milestones),
      completed_missions: [...new Set((subs ?? []).map((s) => s.mission_id as string))],
      ...(patch.current_location ? { current_location: patch.current_location } : {}),
    })
    .eq("id", playerId);
}
