import Link from "next/link";
import { GAME_CONFIG } from "@/config/game";
import { PortalEffects } from "./PortalEffects";

const primers = [
  {
    title: "Linux",
    color: "#f59e0b",
    body: "The operating system everything runs on. Packages install services (apt), systemctl controls them, files live under /etc, /var, /home.",
  },
  {
    title: "Apache",
    color: "#ef4444",
    body: "The web server. Listens on 80/443, maps URLs to files under DocumentRoot (/var/www/html), and virtual hosts let one box serve many sites.",
  },
  {
    title: "MySQL / MariaDB",
    color: "#38bdf8",
    body: "The database. CREATE DATABASE/TABLE define structure, INSERT fills it, SELECT reads it, GRANT controls who may touch it — never connect as root.",
  },
  {
    title: "PHP",
    color: "#818cf8",
    body: "The application language. Runs inside Apache, talks to MySQL via mysqli/PDO, hashes passwords with password_hash, and guards SQL with prepared statements.",
  },
  {
    title: "Networking",
    color: "#34d399",
    body: "Requests arrive over HTTP(S). TLS encrypts port 443; a firewall (UFW) decides which ports are even reachable. Logs prove what happened.",
  },
  {
    title: "Deployment",
    color: "#fb923c",
    body: "Shipping means repeatability: update the OS, install services, configure them, deploy code, restrict permissions, and back up the data on a schedule.",
  },
];

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const section = typeof params.section === "string" ? params.section : undefined;

  return (
    <main className="min-h-dvh bg-slate-950 text-slate-200">
      <PortalEffects highlight={section === "introduction"} />
      <div className="mx-auto max-w-3xl px-5 py-10">
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-red-400">◤ Incoming transmission · clearance: public</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-50">Mission Dossier — The Server Quest</h1>
        <p className="mt-1 text-xs uppercase tracking-widest text-slate-500">Origin: the Magic Box · Relay: Introduction Hub</p>

        <section id="introduction" data-portal-section="introduction" className="mt-8 rounded-2xl border border-violet-400/30 bg-violet-500/5 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-violet-300">01 · The world</h2>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-300">
            <p>
              You are a newly arrived engineer in a valley town whose businesses run on real servers. Your house hides
              a Magic Box — an artifact that receives mission files from the companies that keep this town online.
            </p>
            <p>
              Two companies are hiring. <b className="text-orange-300">ByteForge Solutions</b>, a small friendly shop,
              needs a student portal deployed on a LAMP stack. <b className="text-cyan-300">NexaCore Technologies</b>, an
              enterprise operation, needs a hardened production employee portal — and only opens its doors to engineers
              who have proven themselves at ByteForge.
            </p>
            <p>
              You will write real commands, real SQL, and real PHP. Your uploads are checked line by line. When your
              implementation passes, you document the procedure — because engineers who can&apos;t document can&apos;t be trusted
              with production.
            </p>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-cyan-300">02 · Field primer</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {primers.map((p) => (
              <article key={p.title} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <h3 className="text-sm font-bold" style={{ color: p.color }}>{p.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">03 · Rules of engagement</h2>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-300">
            <li>Accept a ticket at a company, then deliver a single archive with your work.</li>
            <li>Every requirement is machine-checked; hints exist but cost points.</li>
            <li>A passed implementation plus an accepted procedure closes the ticket.</li>
            <li>Finish both companies to earn the Server Quest Champion title.</li>
          </ul>
        </section>

        <div className="mt-8 flex justify-center">
          <Link
            href={GAME_CONFIG.RETURN_TO_GAME_URL}
            className="rounded-xl bg-cyan-500 px-8 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:bg-cyan-400"
          >
            Return to Game →
          </Link>
        </div>
      </div>
    </main>
  );
}
