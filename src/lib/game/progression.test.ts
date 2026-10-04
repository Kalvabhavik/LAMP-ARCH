import { describe, expect, it } from "vitest";
import {
  clientMilestoneAllowed,
  cascadeMilestones,
  deriveQuestState,
  levelFor,
} from "@/lib/game/progression";

const set = (...ms: string[]) => new Set(ms);

describe("clientMilestoneAllowed", () => {
  it("enforces the client-postable chain", () => {
    expect(clientMilestoneAllowed(set(), "entered_home")).toBe("locked");
    expect(clientMilestoneAllowed(set("registered"), "entered_home")).toBe("ok");
    expect(clientMilestoneAllowed(set("registered"), "found_magic_box")).toBe("locked");
    expect(clientMilestoneAllowed(set("registered", "entered_home"), "found_magic_box")).toBe("ok");
    expect(clientMilestoneAllowed(set("registered", "entered_home", "found_magic_box"), "visited_intro_hub")).toBe("ok");
  });

  it("gates company joins on the unlockedBy milestone", () => {
    const base = set("registered", "entered_home", "found_magic_box");
    expect(clientMilestoneAllowed(base, "company:byteforge:joined")).toBe("locked");
    expect(clientMilestoneAllowed(set(...base, "visited_intro_hub"), "company:byteforge:joined")).toBe("ok");
    // Can't join nexacore before byteforge is completed.
    expect(clientMilestoneAllowed(set(...base, "visited_intro_hub", "company:byteforge:joined"), "company:nexacore:joined")).toBe("locked");
    expect(
      clientMilestoneAllowed(set(...base, "visited_intro_hub", "company:byteforge:completed"), "company:nexacore:joined"),
    ).toBe("ok");
  });

  it("rejects server-only and unknown milestones", () => {
    expect(clientMilestoneAllowed(set(), "registered")).toBe("unknown");
    expect(clientMilestoneAllowed(set(), "mission:BF-001:passed")).toBe("unknown");
    expect(clientMilestoneAllowed(set(), "game:completed")).toBe("unknown");
    expect(clientMilestoneAllowed(set(), "company:evilcorp:joined")).toBe("unknown");
  });
});

describe("cascadeMilestones", () => {
  it("unlocks nexacore when byteforge completes, then completes the game", () => {
    const ms = set("mission:BF-001:documented");
    const added = cascadeMilestones(ms);
    expect(added).toEqual(
      expect.arrayContaining(["company:byteforge:completed", "company:nexacore:unlocked"]),
    );
    expect(added).not.toContain("game:completed");

    ms.add("mission:NC-001:documented");
    const added2 = cascadeMilestones(ms);
    expect(added2).toEqual(expect.arrayContaining(["company:nexacore:completed", "game:completed"]));
  });

  it("is idempotent", () => {
    const ms = set("mission:BF-001:documented", "company:byteforge:completed", "company:nexacore:unlocked");
    expect(cascadeMilestones(ms)).toEqual([]);
  });
});

describe("deriveQuestState / levelFor", () => {
  it("walks the level ladder", () => {
    expect(levelFor(set())).toBe(1);
    expect(levelFor(set("found_magic_box"))).toBe(2);
    expect(levelFor(set("visited_intro_hub"))).toBe(3);
    expect(levelFor(set("company:nexacore:unlocked"))).toBe(4);
    expect(levelFor(set("game:completed"))).toBe(5);
  });

  it("tracks objectives and tracker statuses in order", () => {
    const fresh = deriveQuestState(["registered"]);
    expect(fresh.currentObjective).toBe("Enter your house");
    expect(fresh.trackerItems[0]).toEqual({ label: "Entered Home", status: "current" });
    expect(fresh.trackerItems[1].status).toBe("locked");
    expect(fresh.unlockedCompanies).toEqual([]);

    const mid = deriveQuestState(["registered", "entered_home", "found_magic_box", "visited_intro_hub"]);
    expect(mid.currentObjective).toBe("Visit ByteForge Solutions (west road)");
    expect(mid.unlockedCompanies).toEqual(["byteforge"]);
    expect(mid.level).toBe(3);

    const done = deriveQuestState([
      "registered",
      "entered_home",
      "found_magic_box",
      "visited_intro_hub",
      "company:byteforge:joined",
      "mission:BF-001:accepted",
      "mission:BF-001:passed",
      "mission:BF-001:documented",
      "company:byteforge:completed",
      "company:nexacore:unlocked",
      "company:nexacore:joined",
      "mission:NC-001:accepted",
      "mission:NC-001:passed",
      "mission:NC-001:documented",
      "company:nexacore:completed",
      "game:completed",
    ]);
    expect(done.currentObjective).toBe("Quest complete! You are production ready.");
    expect(done.trackerItems.every((i) => i.status === "done")).toBe(true);
    expect(done.levelName).toBe("Complete");
  });
});
