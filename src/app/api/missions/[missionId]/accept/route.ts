import { requirePlayer } from "@/lib/supabase/server";
import { ApiError, okJson, withErrors } from "@/lib/api/errors";
import { buildGameState, type GameEvent } from "@/lib/game/state";
import { loadMilestones, recordMilestones, syncPlayer } from "@/lib/game/mutations";
import { MILESTONE } from "@/lib/game/progression";
import { getQuestMission } from "@/content/quest/missions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ missionId: string }> };

export const POST = withErrors<Ctx>(async (request: Request, ctx: Ctx) => {
  const { missionId } = await ctx.params;
  const { supabase, user, player } = await requirePlayer(request);
  const mission = getQuestMission(decodeURIComponent(missionId));
  if (!mission) throw new ApiError(404, "UNKNOWN_MISSION", `Unknown mission "${missionId}".`);

  const milestones = await loadMilestones(supabase, user.id);
  if (!milestones.has(MILESTONE.companyJoined(mission.companyId))) {
    throw new ApiError(403, "COMPANY_NOT_JOINED", `Join ${mission.companyId} first.`);
  }

  const events: GameEvent[] = await recordMilestones(
    supabase,
    user.id,
    milestones,
    [MILESTONE.missionAccepted(mission.id)],
    { level: player.current_level, location: player.current_location },
  );
  await syncPlayer(supabase, user.id, milestones);
  return okJson({ state: await buildGameState(supabase, user.id), events });
});
