import type { CompanyId, MissionId } from "@/types/mission";

export type CompanyDefinition = {
  id: CompanyId;
  name: string;
  tagline: string;
  order: number;
  size: "small" | "large";
  color: string;
  missionIds: MissionId[];
  manager: { name: string; title: string; npcId: string };
  /** Milestone that must be completed before the company building can be entered. */
  unlockedBy: string;
};

export const COMPANIES: CompanyDefinition[] = [
  {
    id: "byteforge",
    name: "ByteForge Solutions",
    tagline: "Small team. Real servers.",
    order: 1,
    size: "small",
    color: "#f97316",
    missionIds: ["BF-001"],
    manager: { name: "Alex Morgan", title: "Engineering Manager", npcId: "alex" },
    unlockedBy: "visited_intro_hub",
  },
  {
    id: "nexacore",
    name: "NexaCore Technologies",
    tagline: "Production at scale.",
    order: 2,
    size: "large",
    color: "#38bdf8",
    missionIds: ["NC-001"],
    manager: { name: "Priya Nair", title: "Head of Infrastructure", npcId: "priya" },
    unlockedBy: "company:byteforge:completed",
  },
];

export function getCompany(id: string) {
  return COMPANIES.find((company) => company.id === id);
}
