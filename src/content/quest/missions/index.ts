import { BF_001 } from "@/content/quest/missions/bf-001";
import { NC_001 } from "@/content/quest/missions/nc-001";
import type { MissionDefinition, MissionId } from "@/types/mission";

export const QUEST_MISSIONS: MissionDefinition[] = [BF_001, NC_001];

export function getQuestMission(id: string): MissionDefinition | undefined {
  return QUEST_MISSIONS.find((mission) => mission.id === (id as MissionId));
}
