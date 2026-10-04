import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveQuestState, type QuestState } from "@/lib/game/progression";
import { ApiError } from "@/lib/api/errors";
import type { PlayerRow } from "@/lib/supabase/server";

export type GameEvent =
  | { type: "achievement"; key: string; name: string; description: string }
  | { type: "score"; delta: number; reason: string; label: string }
  | { type: "milestone"; key: string };

export type GameState = {
  player: {
    id: string;
    name: string;
    gender: string;
    currentLevel: number;
    currentLocation: string;
    score: number;
    completedMissions: string[];
    createdAt: string;
  };
  milestones: string[];
  achievements: { key: string; name: string; description: string; unlockedAt: string }[];
  hintsUnlocked: Record<string, number[]>;
  submissions: Record<string, unknown>;
  procedures: Record<string, unknown>;
  training: { xp: number; completedMissionIds: string[]; collectedCrystalIds: string[] };
  quest: QuestState;
};

/** Load every table for the player and assemble the GameState payload. */
export async function buildGameState(supabase: SupabaseClient, playerId: string): Promise<GameState> {
  const [playerRes, progressRes, achRes, hintsRes, subsRes, procsRes] = await Promise.all([
    supabase.from("players").select("*").eq("id", playerId).maybeSingle(),
    supabase.from("game_progress").select("milestone").eq("player_id", playerId).eq("status", "completed"),
    supabase.from("achievements").select("achievement_key, achievement_name, description, unlocked_at").eq("player_id", playerId),
    supabase.from("hint_unlocks").select("mission_id, hint_index").eq("player_id", playerId),
    supabase.from("submissions").select("*").eq("player_id", playerId).order("submitted_at", { ascending: false }),
    supabase.from("procedures").select("*").eq("player_id", playerId).order("created_at", { ascending: false }),
  ]);
  for (const res of [playerRes, progressRes, achRes, hintsRes, subsRes, procsRes]) {
    if (res.error) throw new ApiError(500, "DB_ERROR", "Failed to load game state.");
  }
  if (!playerRes.data) throw new ApiError(404, "PLAYER_NOT_FOUND", "Register a player first.");
  const player = playerRes.data as PlayerRow;

  const milestones = (progressRes.data ?? []).map((r) => r.milestone as string);

  const hintsUnlocked: Record<string, number[]> = {};
  for (const row of hintsRes.data ?? []) {
    (hintsUnlocked[row.mission_id] ??= []).push(row.hint_index);
  }

  const latest = <T extends { mission_id: string }>(rows: T[] | null): Record<string, T> => {
    const map: Record<string, T> = {};
    for (const row of rows ?? []) if (!map[row.mission_id]) map[row.mission_id] = row;
    return map;
  };

  const submissions: Record<string, unknown> = {};
  for (const [missionId, row] of Object.entries(latest(subsRes.data))) {
    submissions[missionId] = {
      id: row.id,
      missionId,
      attempt: row.attempt,
      status: row.status,
      score: row.score,
      feedback: row.feedback,
      fileName: row.file_name,
      submittedAt: row.submitted_at,
      checkedAt: row.checked_at,
    };
  }
  const procedures: Record<string, unknown> = {};
  for (const [missionId, row] of Object.entries(latest(procsRes.data))) {
    procedures[missionId] = {
      id: row.id,
      missionId,
      attempt: row.attempt,
      status: row.status,
      score: row.score,
      feedback: row.feedback,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    };
  }

  const training = (player.metadata?.training ?? {}) as Partial<GameState["training"]>;

  return {
    player: {
      id: player.id,
      name: player.name,
      gender: player.gender,
      currentLevel: player.current_level,
      currentLocation: player.current_location,
      score: player.score,
      completedMissions: player.completed_missions ?? [],
      createdAt: player.created_at,
    },
    milestones,
    achievements: (achRes.data ?? []).map((a) => ({
      key: a.achievement_key,
      name: a.achievement_name,
      description: a.description,
      unlockedAt: a.unlocked_at,
    })),
    hintsUnlocked,
    submissions,
    procedures,
    training: {
      xp: typeof training.xp === "number" ? training.xp : 0,
      completedMissionIds: Array.isArray(training.completedMissionIds) ? training.completedMissionIds : [],
      collectedCrystalIds: Array.isArray(training.collectedCrystalIds) ? training.collectedCrystalIds : [],
    },
    quest: deriveQuestState(milestones),
  };
}
