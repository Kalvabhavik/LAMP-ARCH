import { requirePlayer } from "@/lib/supabase/server";
import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { buildGameState, type GameEvent } from "@/lib/game/state";
import { loadMilestones, recordMilestones, awardScore, syncPlayer } from "@/lib/game/mutations";
import { clientMilestoneAllowed } from "@/lib/game/progression";
import { getQuestMission } from "@/content/quest/missions";
import { grantAchievement } from "@/lib/game/mutations";

export const runtime = "nodejs";

const LOCATIONS = new Set(["home_exterior", "house", "intro_hub", "byteforge", "nexacore", "outdoor"]);

const LOCATION_REQUIRES: Record<string, string> = {
  byteforge: "visited_intro_hub",
  nexacore: "company:nexacore:unlocked",
};

export const POST = withErrors(async (request: Request) => {
  const { supabase, user, player } = await requirePlayer(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const milestones = await loadMilestones(supabase, user.id);
  const ctx = { level: player.current_level, location: player.current_location };
  const events: GameEvent[] = [];

  switch (body.type) {
    case "milestone": {
      const milestone = body.milestone;
      if (typeof milestone !== "string") throw new ApiError(400, "BAD_REQUEST", "Missing milestone.");
      const verdict = clientMilestoneAllowed(milestones, milestone);
      if (verdict === "unknown") throw new ApiError(400, "UNKNOWN_MILESTONE", `Unknown milestone "${milestone}".`);
      if (verdict === "locked") throw new ApiError(403, "MILESTONE_LOCKED", `Milestone "${milestone}" is not available yet.`);
      events.push(...(await recordMilestones(supabase, user.id, milestones, [milestone], ctx)));
      if (milestone === "found_magic_box") {
        const explorer = await grantAchievement(supabase, user.id, "explorer");
        if (explorer) events.push(explorer);
      }
      break;
    }
    case "location": {
      const location = body.location;
      if (typeof location !== "string" || !LOCATIONS.has(location)) {
        throw new ApiError(400, "INVALID_LOCATION", "Unknown location.");
      }
      const requires = LOCATION_REQUIRES[location];
      if (requires && !milestones.has(requires)) {
        throw new ApiError(403, "LOCATION_LOCKED", `Location "${location}" is locked.`);
      }
      await syncPlayer(supabase, user.id, milestones, { current_location: location });
      break;
    }
    case "hint": {
      const missionId = body.missionId;
      const hintIndex = body.hintIndex;
      const mission = typeof missionId === "string" ? getQuestMission(missionId) : undefined;
      if (!mission) throw new ApiError(400, "UNKNOWN_MISSION", "Unknown missionId.");
      if (typeof hintIndex !== "number" || !Number.isInteger(hintIndex) || hintIndex < 0 || hintIndex >= mission.hints.length) {
        throw new ApiError(400, "INVALID_HINT", "hintIndex out of range.");
      }
      if (!milestones.has(`mission:${mission.id}:accepted`)) {
        throw new ApiError(403, "MISSION_NOT_ACCEPTED", "Accept the mission before using hints.");
      }
      const { data: inserted, error } = await supabase
        .from("hint_unlocks")
        .upsert(
          { player_id: user.id, mission_id: mission.id, hint_index: hintIndex },
          { onConflict: "player_id,mission_id,hint_index", ignoreDuplicates: true },
        )
        .select("hint_index");
      if (error) throw new ApiError(500, "DB_ERROR", "Failed to unlock hint.");
      if ((inserted?.length ?? 0) === 1) {
        events.push(await awardScore(supabase, user.id, "hintUsed", mission.id));
      }
      break;
    }
    case "training": {
      const t = body.training as Record<string, unknown> | undefined;
      const xp = t?.xp;
      const completed = t?.completedMissionIds;
      const crystals = t?.collectedCrystalIds;
      const okXp = typeof xp === "number" && Number.isInteger(xp) && xp >= 0 && xp <= 100000;
      const okList = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 100 && v.every((x) => typeof x === "string");
      if (!t || !okXp || !okList(completed) || !okList(crystals)) {
        throw new ApiError(400, "INVALID_TRAINING", "training must be {xp:int 0..100000, completedMissionIds:string[≤100], collectedCrystalIds:string[≤100]}.");
      }
      const metadata = { ...(player.metadata ?? {}), training: { xp, completedMissionIds: completed, collectedCrystalIds: crystals } };
      await supabase.from("players").update({ metadata }).eq("id", user.id);
      break;
    }
    default:
      throw new ApiError(400, "BAD_REQUEST", "type must be one of milestone|location|hint|training.");
  }

  await syncPlayer(supabase, user.id, milestones);
  return okJson({ state: await buildGameState(supabase, user.id), events });
});

