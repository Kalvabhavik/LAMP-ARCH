export type AchievementKey =
  | "first_step"
  | "explorer"
  | "linux_engineer"
  | "lamp_builder"
  | "documentation_master"
  | "production_ready"
  | "server_quest_champion"
  | "curious_mind"
  | "campus_scholar";

export type AchievementDefinition = {
  key: AchievementKey;
  name: string;
  description: string;
  /** Human-readable rule; the server is the only place achievements are granted. */
  trigger: string;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { key: "first_step", name: "First Step", description: "Entered the game for the first time.", trigger: "Player registered." },
  { key: "explorer", name: "Explorer", description: "Found the Magic Box.", trigger: "Milestone found_magic_box." },
  { key: "linux_engineer", name: "Linux Engineer", description: "Completed the first Linux task.", trigger: "First submission where every requirement tagged `linux` passed." },
  { key: "lamp_builder", name: "LAMP Builder", description: "Completed the first LAMP mission.", trigger: "BF-001 submission passed." },
  { key: "documentation_master", name: "Documentation Master", description: "Submitted a complete procedure.", trigger: "A procedure review with complete = true." },
  { key: "production_ready", name: "Production Ready", description: "Completed the NexaCore mission.", trigger: "NC-001 submission passed." },
  { key: "server_quest_champion", name: "Server Quest Champion", description: "Finished LAMP: The Server Quest.", trigger: "Milestone game:completed." },
  { key: "curious_mind", name: "Curious Mind", description: "Studied your first training page.", trigger: "Any site-study milestone." },
  { key: "campus_scholar", name: "Campus Scholar", description: "Studied every training page in the valley.", trigger: "All site-study milestones." },
];
