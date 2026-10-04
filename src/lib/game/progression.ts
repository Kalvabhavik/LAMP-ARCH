import { COMPANIES, getCompany } from "@/content/quest/companies";
import { getQuestMission } from "@/content/quest/missions";

// ---------------------------------------------------------------- milestones

export const MILESTONE = {
  registered: "registered",
  enteredHome: "entered_home",
  foundMagicBox: "found_magic_box",
  openedMissionPortal: "opened_mission_portal",
  visitedIntroHub: "visited_intro_hub",
  companyJoined: (id: string) => `company:${id}:joined`,
  missionAccepted: (id: string) => `mission:${id}:accepted`,
  missionPassed: (id: string) => `mission:${id}:passed`,
  missionDocumented: (id: string) => `mission:${id}:documented`,
  companyCompleted: (id: string) => `company:${id}:completed`,
  companyUnlocked: (id: string) => `company:${id}:unlocked`,
  gameCompleted: "game:completed",
} as const;

/** Milestones the client may post itself (everything else is server-written). */
export const CLIENT_MILESTONE_PREREQS: Record<string, string | undefined> = {
  [MILESTONE.enteredHome]: MILESTONE.registered,
  [MILESTONE.foundMagicBox]: MILESTONE.enteredHome,
  // Recorded, never gates anything further.
  [MILESTONE.openedMissionPortal]: MILESTONE.foundMagicBox,
  [MILESTONE.visitedIntroHub]: MILESTONE.foundMagicBox,
};

/**
 * Whether `milestone` is a client-postable milestone whose prerequisite is met.
 * `company:<id>:joined` is client-postable when the company is unlocked
 * (its `unlockedBy` milestone is complete). Everything else returns false.
 */
export function clientMilestoneAllowed(milestones: Set<string>, milestone: string): "ok" | "unknown" | "locked" {
  if (milestone in CLIENT_MILESTONE_PREREQS) {
    const prereq = CLIENT_MILESTONE_PREREQS[milestone];
    return prereq === undefined || milestones.has(prereq) ? "ok" : "locked";
  }
  const joined = /^company:([\w-]+):joined$/.exec(milestone);
  if (joined) {
    const company = getCompany(joined[1]);
    if (!company) return "unknown";
    return milestones.has(company.unlockedBy) ? "ok" : "locked";
  }
  return "unknown";
}

/**
 * Extra milestones implied by the ones already recorded (company unlocks,
 * company completions, game completion). Pass a set that is mutated in place;
 * returns the newly added keys, cascaded to fixpoint.
 */
export function cascadeMilestones(milestones: Set<string>): string[] {
  const added: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const company of COMPANIES) {
      const unlocked = MILESTONE.companyUnlocked(company.id);
      if (milestones.has(company.unlockedBy) && !milestones.has(unlocked)) {
        milestones.add(unlocked);
        added.push(unlocked);
        changed = true;
      }
      const completed = MILESTONE.companyCompleted(company.id);
      if (
        !milestones.has(completed) &&
        company.missionIds.every((id) => milestones.has(MILESTONE.missionDocumented(id)))
      ) {
        milestones.add(completed);
        added.push(completed);
        changed = true;
      }
    }
    if (!milestones.has(MILESTONE.gameCompleted) && COMPANIES.every((c) => milestones.has(MILESTONE.companyCompleted(c.id)))) {
      milestones.add(MILESTONE.gameCompleted);
      added.push(MILESTONE.gameCompleted);
      changed = true;
    }
  }
  return added;
}

// ----------------------------------------------------------------- levels

export const LEVEL_NAMES = ["Home", "Introduction Hub", "ByteForge", "NexaCore", "Complete"] as const;

export function levelFor(milestones: Set<string>): number {
  if (milestones.has(MILESTONE.gameCompleted)) return 5;
  if (milestones.has(MILESTONE.companyUnlocked("nexacore"))) return 4;
  if (milestones.has(MILESTONE.visitedIntroHub)) return 3;
  if (milestones.has(MILESTONE.foundMagicBox)) return 2;
  return 1;
}

// ------------------------------------------------------------ derived state

export type TrackerStatus = "done" | "current" | "locked";
export type TrackerItem = { label: string; status: TrackerStatus };

export type QuestState = {
  level: number;
  levelName: string;
  unlockedCompanies: string[];
  currentObjective: string;
  trackerItems: TrackerItem[];
};

const OBJECTIVES: [string, string][] = [
  [MILESTONE.enteredHome, "Enter your house"],
  [MILESTONE.foundMagicBox, "Search the house for the Magic Box"],
  [MILESTONE.visitedIntroHub, "Head to the Introduction Hub at the plaza"],
  [MILESTONE.companyJoined("byteforge"), "Visit ByteForge Solutions (west road)"],
  [MILESTONE.missionAccepted("BF-001"), "Talk to Alex Morgan, your manager"],
  [MILESTONE.missionPassed("BF-001"), "Complete mission BF-001 and upload your solution"],
  [MILESTONE.missionDocumented("BF-001"), "Submit your BF-001 procedure"],
  [MILESTONE.companyJoined("nexacore"), "NexaCore Technologies is unlocked — head east"],
  [MILESTONE.missionAccepted("NC-001"), "Talk to Priya Nair"],
  [MILESTONE.missionPassed("NC-001"), "Complete mission NC-001"],
  [MILESTONE.missionDocumented("NC-001"), "Submit your NC-001 procedure"],
];

const TRACKER: [string, string][] = [
  [MILESTONE.enteredHome, "Entered Home"],
  [MILESTONE.foundMagicBox, "Found Magic Box"],
  [MILESTONE.visitedIntroHub, "Visited Introduction Hub"],
  [MILESTONE.companyJoined("byteforge"), "Joined ByteForge Solutions"],
  [MILESTONE.missionPassed("BF-001"), "Completed Mission BF-001"],
  [MILESTONE.missionDocumented("BF-001"), "Submit Procedure (BF-001)"],
  [MILESTONE.companyCompleted("byteforge"), "ByteForge Complete"],
  [MILESTONE.companyUnlocked("nexacore"), "NexaCore Unlocked"],
  [MILESTONE.companyJoined("nexacore"), "Joined NexaCore Technologies"],
  [MILESTONE.missionPassed("NC-001"), "Completed Mission NC-001"],
  [MILESTONE.missionDocumented("NC-001"), "Submit Procedure (NC-001)"],
  [MILESTONE.gameCompleted, "Server Quest Complete"],
];

/** Human-readable titles for milestone keys (toasts, logs). */
export const MILESTONE_LABELS: Record<string, string> = Object.fromEntries(
  TRACKER.map(([key, label]) => [key, label]),
);
MILESTONE_LABELS[MILESTONE.registered] = "Registered";
MILESTONE_LABELS[MILESTONE.openedMissionPortal] = "Opened the mission portal";
MILESTONE_LABELS[MILESTONE.missionAccepted("BF-001")] = "Accepted mission BF-001";
MILESTONE_LABELS[MILESTONE.missionAccepted("NC-001")] = "Accepted mission NC-001";
MILESTONE_LABELS[MILESTONE.companyJoined("byteforge")] = "Joined ByteForge Solutions";
MILESTONE_LABELS[MILESTONE.companyJoined("nexacore")] = "Joined NexaCore Technologies";

export function milestoneLabel(key: string): string {
  if (MILESTONE_LABELS[key]) return MILESTONE_LABELS[key];
  const joined = /^company:([\w-]+):joined$/.exec(key);
  if (joined) {
    const company = getCompany(joined[1]);
    if (company) return `Joined ${company.name}`;
  }
  const unlocked = /^company:([\w-]+):unlocked$/.exec(key);
  if (unlocked) {
    const company = getCompany(unlocked[1]);
    if (company) return `${company.name} unlocked`;
  }
  const completed = /^company:([\w-]+):completed$/.exec(key);
  if (completed) {
    const company = getCompany(completed[1]);
    if (company) return `${company.name} complete`;
  }
  return key.replace(/[:_]/g, " ");
}

export function deriveQuestState(milestones: Iterable<string>): QuestState {
  const set = milestones instanceof Set ? milestones : new Set(milestones);
  const level = levelFor(set);
  const objective = OBJECTIVES.find(([m]) => !set.has(m));

  let currentAssigned = false;
  const trackerItems: TrackerItem[] = TRACKER.map(([milestone, label]) => {
    if (set.has(milestone)) return { label, status: "done" };
    if (!currentAssigned) {
      currentAssigned = true;
      return { label, status: "current" };
    }
    return { label, status: "locked" };
  });

  return {
    level,
    levelName: LEVEL_NAMES[level - 1],
    unlockedCompanies: COMPANIES.filter((c) => set.has(c.unlockedBy)).map((c) => c.id),
    currentObjective: objective ? objective[1] : "Quest complete! You are production ready.",
    trackerItems,
  };
}

export { getCompany, getQuestMission };
