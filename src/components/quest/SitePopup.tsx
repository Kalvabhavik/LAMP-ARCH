"use client";

import { useEffect, useState } from "react";
import { getStation } from "@/content/stations";
import { SITE_STUDY_SECONDS, STATION_SITE_IDS, STATION_SITES } from "@/content/quest/station-sites";
import { MILESTONE } from "@/lib/game/progression";
import { isTypingTarget } from "@/lib/world/runtime";
import type { StationId } from "@/types/game";
import { useQuestStore } from "@/stores/quest-store";

export function SitePopup({ siteId }: { siteId: StationId }) {
  const site = STATION_SITES[siteId];
  const station = getStation(siteId);
  const milestones = useQuestStore((state) => state.state?.milestones ?? []);
  const postMilestone = useQuestStore((state) => state.postMilestone);
  const closeOverlay = useQuestStore((state) => state.closeOverlay);
  const studiedKey = MILESTONE.siteStudied(siteId);
  const studied = milestones.includes(studiedKey);
  const studiedCount = STATION_SITE_IDS.filter((id) => milestones.includes(MILESTONE.siteStudied(id))).length;
  const [remaining, setRemaining] = useState(SITE_STUDY_SECONDS);
  const [loaded, setLoaded] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isTypingTarget(event.target)) closeOverlay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeOverlay]);

  useEffect(() => {
    if (!site.url || studied) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [site.url, siteId, studied]);

  const timerProgress = ((SITE_STUDY_SECONDS - remaining) / SITE_STUDY_SECONDS) * 100;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[70] flex items-center justify-center bg-black/75 p-3 sm:p-5">
      <section
        aria-label={`${site.title} training page`}
        aria-modal="true"
        className="flex h-[86vh] w-[min(1100px,94vw)] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#111418] text-slate-100"
        role="dialog"
      >
        <header className="relative flex min-h-[72px] shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-[#191d22] px-4 py-3 pl-5">
          <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: station.themeColor }} />
          <div className="min-w-[150px] flex-1">
            <h2 className="text-base font-semibold">{site.title}</h2>
            <p className="text-xs text-slate-400">{site.blurb}</p>
          </div>
          <input
            aria-label="Page address"
            className="min-w-[160px] flex-1 rounded-md border border-white/10 bg-[#0c0f12] px-3 py-2 text-xs text-slate-400 outline-none"
            readOnly
            value={site.url}
          />
          {site.url ? (
            <a
              className="rounded-md border border-white/10 bg-[#22272d] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#2b3138]"
              href={site.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open in new tab
            </a>
          ) : null}
          <button
            aria-label="Close site"
            className="rounded-md border border-white/10 bg-[#22272d] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-[#2b3138]"
            onClick={closeOverlay}
            type="button"
          >
            Close
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-[#0d1013]">
          {site.url ? (
            <>
              <iframe
                className="h-full w-full border-0 bg-white"
                onLoad={() => setLoaded(true)}
                referrerPolicy="no-referrer"
                
                src={site.url}
                title={site.title}
              />
              {!loaded ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0d1013] text-sm text-slate-400">
                  Loading webpage…
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <h3 className="text-lg font-semibold text-slate-200">No page linked yet</h3>
              <p className="mt-2 max-w-md text-sm text-slate-400">
                LINK ERROR 
              </p>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-[#191d22] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-300">Training pages studied: {studiedCount} / {STATION_SITE_IDS.length}</span>
                <span className="text-slate-500">Study record</span>
              </div>
              <div aria-label={`${studiedCount} of ${STATION_SITE_IDS.length} training pages studied`} className="flex gap-1">
                {STATION_SITE_IDS.map((id) => {
                  const complete = milestones.includes(MILESTONE.siteStudied(id));
                  return (
                    <span
                      aria-label={`${STATION_SITES[id].title}: ${complete ? "studied" : "not studied"}`}
                      className="h-2 flex-1 rounded-sm bg-[#30363d]"
                      key={id}
                      style={complete ? { backgroundColor: getStation(id).themeColor } : undefined}
                    />
                  );
                })}
              </div>
            </div>

            {studied ? (
              <span className="rounded-md border border-white/10 bg-[#22272d] px-3 py-2 text-xs font-medium text-slate-400">
                Studied
              </span>
            ) : site.url ? (
              <div className="min-w-[220px]">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Study timer</span>
                  <span>{remaining}s</span>
                </div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-sm bg-[#30363d]">
                  <div className="h-full bg-slate-400 transition-[width]" style={{ width: `${timerProgress}%` }} />
                </div>
                {remaining === 0 ? (
                  <button
                    className="w-full rounded-md border border-white/10 bg-[#30363d] px-3 py-2 text-xs font-semibold text-white hover:bg-[#3b424a] disabled:opacity-50"
                    disabled={marking}
                    onClick={async () => {
                      setMarking(true);
                      await postMilestone(MILESTONE.siteStudied(siteId));
                      setMarking(false);
                    }}
                    type="button"
                  >
                    {marking ? "Saving…" : "Mark as studied  +25 pts"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </footer>
      </section>
    </div>
  );
}
