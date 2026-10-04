"use client";

import { useEffect } from "react";

/** Client-side niceties: scroll to ?section=introduction and pulse its highlight. */
export function PortalEffects({ highlight }: { highlight: boolean }) {
  useEffect(() => {
    if (!highlight) return;
    const el = document.getElementById("introduction");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.style.transition = "box-shadow 0.4s";
    el.style.boxShadow = "0 0 0 2px rgba(167,139,250,0.6), 0 0 40px rgba(167,139,250,0.25)";
    const t = setTimeout(() => {
      el.style.boxShadow = "";
    }, 3200);
    return () => clearTimeout(t);
  }, [highlight]);
  return null;
}
