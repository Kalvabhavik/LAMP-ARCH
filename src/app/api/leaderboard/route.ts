import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { requirePlayer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request) => {
  const { supabase, user } = await requirePlayer(request);
  const { data: rows, error: topError } = await supabase
    .from("leaderboard")
    .select("player_id, player_name, total_points, quest_score, training_xp, achievements_count, updated_at")
    .order("total_points", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(10);
  if (topError) throw new ApiError(500, "DB_ERROR", "Failed to load the leaderboard.");

  const { data: you, error: youError } = await supabase
    .from("leaderboard")
    .select("player_id, player_name, total_points, quest_score, training_xp, achievements_count")
    .eq("player_id", user.id)
    .maybeSingle();
  if (youError) throw new ApiError(500, "DB_ERROR", "Failed to load your leaderboard entry.");

  let rank: number | null = null;
  if (you) {
    const { count, error: rankError } = await supabase
      .from("leaderboard")
      .select("player_id", { count: "exact", head: true })
      .gt("total_points", you.total_points);
    if (rankError) throw new ApiError(500, "DB_ERROR", "Failed to load your leaderboard rank.");
    rank = (count ?? 0) + 1;
  }

  return okJson({
    leaderboard: {
      top: (rows ?? []).map((row, index) => ({
        rank: index + 1,
        name: row.player_name,
        totalPoints: row.total_points,
        achievements: row.achievements_count,
        isYou: row.player_id === user.id,
      })),
      you: you && rank !== null
        ? {
            rank,
            name: you.player_name,
            totalPoints: you.total_points,
            questScore: you.quest_score,
            trainingXp: you.training_xp,
            achievements: you.achievements_count,
          }
        : null,
    },
  });
});
