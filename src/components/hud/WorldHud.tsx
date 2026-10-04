"use client";

import { useEffect, useRef, useState } from "react";
import { CRYSTALS, CRYSTAL_XP } from "@/content/crystals";
import { WORLD_STATIONS } from "@/content/stations";
import { isTypingTarget, playerState } from "@/lib/world/runtime";
import { LAKE, WATER_LEVEL, getTerrainHeight } from "@/lib/world/terrain";
import { useGameStore, type TimeOfDay } from "@/stores/game-store";

const MAP_SIZE = 168;
const MAP_RANGE = 62;

const TIME_LABEL: Record<TimeOfDay, string> = {
  day: "Day",
  sunset: "Sunset",
  night: "Night",
};

function renderMapBackground() {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const image = context.createImageData(MAP_SIZE, MAP_SIZE);
  for (let py = 0; py < MAP_SIZE; py += 1) {
    for (let px = 0; px < MAP_SIZE; px += 1) {
      const x = (px / MAP_SIZE - 0.5) * MAP_RANGE * 2;
      const z = (py / MAP_SIZE - 0.5) * MAP_RANGE * 2;
      const h = getTerrainHeight(x, z);
      const shade = getTerrainHeight(x - 1, z - 1) - h;
      let rgb: [number, number, number];
      if (h < WATER_LEVEL && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.radius + 2) rgb = [44, 110, 140];
      else if (h > 40) rgb = [235, 238, 244];
      else if (h > 22) rgb = [120, 114, 106];
      else rgb = [70 + h * 2, 112 + h * 1.2, 56];
      const light = Math.max(-40, Math.min(40, shade * 18));
      const i = (py * MAP_SIZE + px) * 4;
      image.data[i] = rgb[0] + light;
      image.data[i + 1] = rgb[1] + light;
      image.data[i + 2] = rgb[2] + light;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const scale = MAP_SIZE / (MAP_RANGE * 2);
  context.fillStyle = "rgba(60,64,68,0.95)";
  context.fillRect(MAP_SIZE / 2 - 1.9 * scale, MAP_SIZE / 2 - 24 * scale, 3.8 * scale, 48 * scale);
  context.fillRect(MAP_SIZE / 2 - 24 * scale, MAP_SIZE / 2 - 1.9 * scale, 48 * scale, 3.8 * scale);
  return canvas;
}

function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const unlocked = useGameStore((state) => state.unlockedStationIds);
  const collected = useGameStore((state) => state.collectedCrystalIds);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const background = renderMapBackground();
    const scale = MAP_SIZE / (MAP_RANGE * 2);
    const toMap = (x: number, z: number): [number, number] => [MAP_SIZE / 2 + x * scale, MAP_SIZE / 2 + z * scale];
    let frame = 0;

    const draw = () => {
      context.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
      context.drawImage(background, 0, 0);

      for (const crystal of CRYSTALS) {
        if (collected.includes(crystal.id)) continue;
        const [cx, cy] = toMap(crystal.position[0], crystal.position[1]);
        context.fillStyle = "#67e8f9";
        context.beginPath();
        context.moveTo(cx, cy - 3.5);
        context.lineTo(cx + 2.5, cy);
        context.lineTo(cx, cy + 3.5);
        context.lineTo(cx - 2.5, cy);
        context.fill();
      }

      for (const station of WORLD_STATIONS) {
        const [sx, sy] = toMap(station.position[0], station.position[2]);
        const open = unlocked.includes(station.id);
        context.fillStyle = open ? station.themeColor : "#64748b";
        context.strokeStyle = "#0f172a";
        context.lineWidth = 1.5;
        context.fillRect(sx - 4, sy - 4, 8, 8);
        context.strokeRect(sx - 4, sy - 4, 8, 8);
      }

      // Quest structures: house + company buildings.
      const structures: [number, number, number, string, string][] = [
        [0, 21, 10, "#a78bfa", "HOME"],
        [-38, 0, 10, "#f97316", "BF"],
        [40, -4, 14, "#38bdf8", "NC"],
      ];
      for (const [bx, bz, size, color, tag] of structures) {
        const [sx, sy] = toMap(bx, bz);
        const half = (size / 2) * scale;
        context.fillStyle = color;
        context.fillRect(sx - half, sy - half, half * 2, half * 2);
        context.fillStyle = "#0f172a";
        context.font = "bold 6px monospace";
        context.textAlign = "center";
        context.fillText(tag, sx, sy + 2);
      }

      const [px, py] = toMap(playerState.position.x, playerState.position.z);
      context.save();
      context.translate(px, py);
      context.rotate(Math.PI - playerState.heading);
      context.fillStyle = "#facc15";
      context.strokeStyle = "#111827";
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(0, -7);
      context.lineTo(5, 5);
      context.lineTo(0, 2.5);
      context.lineTo(-5, 5);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();

      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [unlocked, collected]);

  return (
    <div className="pointer-events-auto relative overflow-hidden rounded-full border-2 border-cyan-400/40 bg-slate-950/80 shadow-lg shadow-cyan-500/10">
      <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} className="block h-[168px] w-[168px]" />
      <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold text-white drop-shadow">N</span>
    </div>
  );
}

function StaminaBar() {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (fill.current) {
        fill.current.style.width = `${Math.round(playerState.stamina * 100)}%`;
        fill.current.style.opacity = playerState.stamina < 0.3 ? "0.6" : "1";
      }
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-400/30 bg-slate-950/90 px-4 py-2 backdrop-blur-md">
      <span className="text-[10px] font-bold tracking-widest text-emerald-300">STAMINA</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div ref={fill} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: "100%" }} />
      </div>
    </div>
  );
}

function CrystalCounter() {
  const collected = useGameStore((state) => state.collectedCrystalIds.length);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-slate-950/90 px-3 py-2 text-xs font-bold text-cyan-200 backdrop-blur-md">
      <span className="inline-block h-2.5 w-2.5 rotate-45 bg-cyan-300 shadow shadow-cyan-300" />
      {collected}/{CRYSTALS.length} CRYSTALS
    </div>
  );
}

function TimeOfDayButton() {
  const timeOfDay = useGameStore((state) => state.timeOfDay);
  const cycleTimeOfDay = useGameStore((state) => state.cycleTimeOfDay);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "KeyT" && !isTypingTarget(event.target)) cycleTimeOfDay();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cycleTimeOfDay]);

  return (
    <button
      type="button"
      onClick={cycleTimeOfDay}
      className="rounded-xl border border-amber-300/30 bg-slate-950/90 px-3 py-2 text-xs font-bold uppercase tracking-wide text-amber-200 backdrop-blur-md transition hover:bg-slate-900"
    >
      {TIME_LABEL[timeOfDay]} · T
    </button>
  );
}

function PickupToast() {
  const lastPickup = useGameStore((state) => state.lastPickup);
  const [visibleAt, setVisibleAt] = useState<number | null>(null);

  useEffect(() => {
    if (!lastPickup) return;
    const show = setTimeout(() => setVisibleAt(lastPickup.at), 0);
    const hide = setTimeout(() => setVisibleAt(null), 2200);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [lastPickup]);

  if (!lastPickup || visibleAt !== lastPickup.at) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 animate-bounce rounded-full border border-cyan-300/50 bg-slate-950/85 px-5 py-2 text-sm font-bold text-cyan-200 shadow-lg shadow-cyan-500/20">
      Data crystal collected · +{CRYSTAL_XP} XP
    </div>
  );
}

export function ControlsHint() {
  const items = [
    ["WASD", "Move"],
    ["Shift", "Sprint"],
    ["Space", "Jump"],
    ["Drag", "Look"],
    ["Scroll", "Zoom"],
    ["E", "Interact"],
    ["J", "Mission"],
    ["T", "Time of day"],
  ];
  return (
    <div className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1 self-start rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-md md:self-end">
      {items.map(([key, label]) => (
        <span key={key}>
          <kbd className="mr-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-white">{key}</kbd>
          {label}
        </span>
      ))}
    </div>
  );
}

export function WorldStatus() {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <StaminaBar />
      <div className="flex gap-2">
        <CrystalCounter />
        <TimeOfDayButton />
      </div>
    </div>
  );
}

export function WorldOverlay() {
  return (
    <>
      <PickupToast />
      <div className="pointer-events-none absolute right-4 top-20 hidden sm:block">
        <Minimap />
      </div>
    </>
  );
}
