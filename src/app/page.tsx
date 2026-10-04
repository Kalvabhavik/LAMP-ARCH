"use client";

import type React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GAME_CONFIG } from "@/config/game";
import { getBrowserSupabase } from "@/lib/supabase/browser";

const journey = [
  { number: "01", title: "HOME", color: "#a78bfa" },
  { number: "02", title: "MAGIC BOX", color: "#c084fc" },
  { number: "03", title: "INTRODUCTION HUB", color: "#34d399" },
  { number: "04", title: "BYTEFORGE", color: "#f97316" },
  { number: "05", title: "NEXACORE", color: "#38bdf8" },
];

export default function Home() {
  const [continueName, setContinueName] = useState<string | null>(null);

  // Non-blocking "Continue as <name>" — only when a session + player row exist.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getBrowserSupabase();
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      try {
        const res = await fetch("/api/player", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const json = await res.json();
        if (!cancelled && json?.ok && json.state?.player?.name) setContinueName(json.state.player.name);
      } catch {
        /* stay anonymous */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="solution-shell" style={{ "--accent": "#22d3ee" } as React.CSSProperties}>
      <div className="scanlines" aria-hidden="true" />
      <header className="solution-header">
        <div className="brand-lockup">
          <span className="brand-mark">SQ</span>
          <div>
            <p className="micro-label">OPEN-WORLD TRAINING / QUEST</p>
            <p className="brand-name">SERVER <span>QUEST</span></p>
          </div>
        </div>
        <div className="header-status"><span className="status-dot" /> WORLD ONLINE <span className="status-divider" /> SECTOR 07</div>
      </header>

      <section className="hero-copy">
        <p className="micro-label accent-label">LAMP // THE SERVER QUEST</p>
        <h1 style={{ color: "#e0f2fe", textShadow: "0 0 30px rgba(34,211,238,.25)" }}>
          LAMP: The <span style={{ color: "#22d3ee" }}>Server Quest</span>
        </h1>
        <p className="hero-subtitle">
          You are a new engineer in a town that runs on real servers. A strange box in your house hums with an
          incoming mission — companies are hiring, tickets are real, and every command you write gets reviewed.
          Deploy. Document. Get promoted.
        </p>
      </section>

      <section className="progression" aria-label="The Server Quest journey">
        <div className="progress-line" aria-hidden="true"><span /></div>
        {journey.map((stage) => (
          <div
            key={stage.number}
            className="stage-node is-active"
            style={{ "--stage": stage.color } as React.CSSProperties}
          >
            <span className="stage-number">{stage.number}</span>
            <span className="stage-title">{stage.title}</span>
            <span className="stage-corner" />
          </div>
        ))}
      </section>

      <section className="console-dock">
        <div className="dock-screen">
          <div className="screen-grid" aria-hidden="true" />
          <div className="screen-content">
            <p className="micro-label">INCOMING TRANSMISSION // 01</p>
            <strong>{continueName ? `WELCOME BACK, ${continueName.toUpperCase()}` : "AWAITING NEW ENGINEER"}</strong>
            <span>
              {continueName
                ? "Your progress is saved — the world remembers you."
                : "Two companies. Two real missions. One engineer."}
            </span>
          </div>
          <div className="screen-meter"><span style={{ width: "20%", background: "#22d3ee" }} /></div>
        </div>
        <div className="flex flex-col gap-2">
          <Link href={GAME_CONFIG.STARTING_PAGE_URL} className="enter-button"><span>{continueName ? `CONTINUE AS ${continueName.toUpperCase()}` : "START MISSION"}</span><b>→</b></Link>
          <Link href={GAME_CONFIG.INTRODUCTION_URL} className="enter-button enter-button--secondary"><span>ENTER INTRODUCTION</span><b>→</b></Link>
        </div>
        <div className="dock-readout"><span>QUEST</span><strong>05</strong><small>ZONES</small></div>
      </section>

      <footer className="solution-footer"><span>© LAMP: THE SERVER QUEST</span><span>YOUR JOURNEY AWAITS <i>●</i></span></footer>
    </main>
  );
}
