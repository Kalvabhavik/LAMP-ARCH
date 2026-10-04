export type KioskDefinition = {
  id: string;
  title: string;
  position: [number, number];
  radius: number;
  accent: string;
  lines: string[];
};

/** Info kiosks in the Introduction Hub — small readable primers. */
export const KIOSKS: KioskDefinition[] = [
  {
    id: "networking",
    title: "Networking",
    position: [-5.5, -4.5],
    radius: 2.6,
    accent: "#38bdf8",
    lines: [
      "Every web app lives behind a listener: Apache binds port 80/443 and answers HTTP requests.",
      "Virtual hosts let one server answer for many sites — ServerName picks the right one.",
      "HTTPS wraps HTTP in TLS: certificates prove identity, port 443 does the encrypting.",
      "Firewalls (UFW) decide which packets reach your services — allow only what you expose.",
      "Logs (ErrorLog / CustomLog) are how you prove what the server actually did.",
    ],
  },
  {
    id: "database",
    title: "Database",
    position: [5.5, -4.5],
    radius: 2.6,
    accent: "#34d399",
    lines: [
      "MariaDB/MySQL stores your app's state in tables: rows of columns with types.",
      "CREATE DATABASE / CREATE TABLE define structure; GRANT defines who may touch it.",
      "Least privilege: the app user gets only the rights it needs, only on its own database.",
      "Never connect as root from application code — create a dedicated user instead.",
      "Prepared statements keep user input out of your SQL — the #1 defense against injection.",
      "mysqldump snapshots the data; schedule it with cron before you need it.",
    ],
  },
];
