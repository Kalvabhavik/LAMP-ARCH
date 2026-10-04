import type { MissionId } from "@/types/mission";

export type DialogueAction =
  | "open_briefing"
  | "accept_mission"
  | "open_hints"
  | "open_submit"
  | "open_procedure"
  | "close";

export type DialogueOption = { label: string; next?: string; action?: DialogueAction };

export type DialogueNode = {
  id: string;
  text: string;
  options: DialogueOption[];
};

export type NpcDialogue = {
  npcId: string;
  missionId: MissionId;
  /** Which entry node to start from, given coarse mission state. */
  entry: (state: "none" | "accepted" | "passed" | "documented") => string;
  nodes: Record<string, DialogueNode>;
};

/** Data-driven dialogue trees — add NPCs by adding entries here and in characters.ts. */
export const DIALOGUES: Record<string, NpcDialogue> = {
  alex: {
    npcId: "alex",
    missionId: "BF-001",
    entry: (state) =>
      state === "documented" ? "after_done" : state === "passed" ? "after_passed" : state === "accepted" ? "after_accepted" : "intro",
    nodes: {
      intro: {
        id: "intro",
        text: "Hey, you must be the new engineer! Alex Morgan — I run this little shop. ByteForge is small, but we do real work for real clients. And right now, Riverside Community College needs a student portal on an actual Linux server. Interested?",
        options: [
          { label: "What is the problem?", next: "problem" },
          { label: "What are the requirements?", next: "requirements" },
          { label: "Can I get a hint?", action: "open_hints" },
          { label: "I'll take it — start the mission", action: "accept_mission" },
        ],
      },
      problem: {
        id: "problem",
        text: "The college had an intern set things up. Half-configured, zero documentation, classic. They need a clean LAMP stack: Apache serving a PHP page that lists students out of MariaDB. Simple on paper — but it has to actually work.",
        options: [
          { label: "What are the requirements?", next: "requirements" },
          { label: "I'll take it — start the mission", action: "accept_mission" },
          { label: "Let me think about it", action: "close" },
        ],
      },
      requirements: {
        id: "requirements",
        text: "Update the system, install Apache, PHP and MariaDB, create the database and a students table — id, name, email, course — then a PHP page that queries and renders it through Apache. One rule from me: don't connect as root, make a dedicated user. Zip up your commands, SQL and PHP and upload it — we'll check every line.",
        options: [
          { label: "I'll take it — start the mission", action: "accept_mission" },
          { label: "Open the mission ticket", action: "open_briefing" },
          { label: "Back", next: "intro" },
        ],
      },
      after_accepted: {
        id: "after_accepted",
        text: "How's the portal coming along? Remember — I need the actual commands, the schema, and the PHP that runs through Apache. Upload your zip when it's ready.",
        options: [
          { label: "Show me the ticket", action: "open_briefing" },
          { label: "Upload my solution", action: "open_submit" },
          { label: "Can I get a hint?", action: "open_hints" },
          { label: "Still working on it", action: "close" },
        ],
      },
      after_passed: {
        id: "after_passed",
        text: "That submission passed review — nice work! One last thing before we call it done: write up your procedure. Real engineers document. Objective, environment, what you installed, how you configured it, what broke, how you fixed it.",
        options: [
          { label: "Submit my procedure", action: "open_procedure" },
          { label: "Show me the ticket", action: "open_briefing" },
          { label: "On it", action: "close" },
        ],
      },
      after_done: {
        id: "after_done",
        text: "BF-001 is done and documented — the college is happy, I'm happy. You've earned it: NexaCore Technologies just unlocked to the east. Priya Nair runs a tighter ship than I do. Good luck!",
        options: [{ label: "Thanks, Alex!", action: "close" }],
      },
    },
  },
  priya: {
    npcId: "priya",
    missionId: "NC-001",
    entry: (state) =>
      state === "documented" ? "after_done" : state === "passed" ? "after_passed" : state === "accepted" ? "after_accepted" : "intro",
    nodes: {
      intro: {
        id: "intro",
        text: "Priya Nair, Head of Infrastructure. Alex says you deliver. Good — because what I'm about to hand you is production. Our Employee Portal goes live this window, and Security reviews every line of your submission.",
        options: [
          { label: "What is the problem?", next: "problem" },
          { label: "What are the requirements?", next: "requirements" },
          { label: "Can I get a hint?", action: "open_hints" },
          { label: "I'll take it — start the mission", action: "accept_mission" },
        ],
      },
      problem: {
        id: "problem",
        text: "A PHP portal with real user login on a fresh server. This isn't a classroom exercise — it needs a dedicated virtual host, HTTPS, hardened PHP, least-privilege database access, secure authentication, a firewall and a backup strategy. Anything less fails review.",
        options: [
          { label: "What are the requirements?", next: "requirements" },
          { label: "I'll take it — start the mission", action: "accept_mission" },
          { label: "I need a moment", action: "close" },
        ],
      },
      requirements: {
        id: "requirements",
        text: "Vhost with ServerName, logs and SSL. PHP with display_errors off. A users table behind a dedicated account — never root, never GRANT ALL. Login via password_hash, prepared statements, sessions. Credentials from the environment, correct permissions, UFW locked to SSH/HTTP/HTTPS, mysqldump on a schedule. Bring me a zip that proves all of it.",
        options: [
          { label: "I'll take it — start the mission", action: "accept_mission" },
          { label: "Open the mission ticket", action: "open_briefing" },
          { label: "Back", next: "intro" },
        ],
      },
      after_accepted: {
        id: "after_accepted",
        text: "The window is open and security is waiting. Upload the deployment when you have evidence for every requirement — vhost, schema, login code, hardening, backup. Partial work doesn't ship.",
        options: [
          { label: "Show me the ticket", action: "open_briefing" },
          { label: "Upload my solution", action: "open_submit" },
          { label: "Can I get a hint?", action: "open_hints" },
          { label: "Understood", action: "close" },
        ],
      },
      after_passed: {
        id: "after_passed",
        text: "Review passed — that's a deployable stack. Now the part most engineers skip: the runbook. Document your procedure completely and I'll sign off the release.",
        options: [
          { label: "Submit my procedure", action: "open_procedure" },
          { label: "Show me the ticket", action: "open_briefing" },
          { label: "Understood", action: "close" },
        ],
      },
      after_done: {
        id: "after_done",
        text: "Deployed, documented, signed off. You didn't just pass a review — you ran a production release. Welcome to the ranks, engineer.",
        options: [{ label: "Thank you, Priya.", action: "close" }],
      },
    },
  },
};

export function getDialogue(npcId: string): NpcDialogue | undefined {
  return DIALOGUES[npcId];
}
