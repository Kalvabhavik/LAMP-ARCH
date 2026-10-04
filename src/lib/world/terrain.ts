import * as THREE from "three";
import { SimplexNoise } from "three/examples/jsm/math/SimplexNoise.js";

export const WORLD_SIZE = 640;
export const TERRAIN_SEGMENTS = 384;
export const CAMPUS_RADIUS = 25;
export const PLAY_RADIUS = 150;
export const WATER_LEVEL = -1.2;
export const TREE_LINE = 30;
export const SNOW_LINE = 46;
export const LAKE = { x: 40, z: 26, radius: 14 };

/** Flat pads for quest structures — terrain blends to 0 inside each radius. */
export const FLAT_ZONES: { x: number; z: number; radius: number }[] = [
  { x: 0, z: 21, radius: 10 }, // house
  { x: -38, z: 0, radius: 12 }, // ByteForge
  { x: 40, z: -4, radius: 15 }, // NexaCore
];
const FLAT_FALLOFF = 8;

const PEAKS = [
  { x: 0, z: -175, radius: 95, height: 100 },
  { x: -125, z: -125, radius: 80, height: 82 },
  { x: 145, z: -95, radius: 78, height: 78 },
  { x: -165, z: 55, radius: 72, height: 66 },
  { x: 135, z: 135, radius: 82, height: 72 },
  { x: -45, z: 175, radius: 72, height: 62 },
];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const noise = new SimplexNoise({ random: mulberry32(20240607) });

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function fbm(x: number, z: number, octaves: number, frequency: number) {
  let amplitude = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amplitude * noise.noise(x * freq, z * freq);
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function ridged(x: number, z: number, octaves: number, frequency: number) {
  let amplitude = 0.5;
  let freq = frequency;
  let sum = 0;
  let weight = 1;
  for (let i = 0; i < octaves; i += 1) {
    let n = 1 - Math.abs(noise.noise(x * freq + 31.7, z * freq - 17.3));
    n *= n;
    n *= weight;
    weight = clamp(n * 2, 0, 1);
    sum += n * amplitude;
    amplitude *= 0.5;
    freq *= 2.1;
  }
  return sum;
}

export function distanceToLake(x: number, z: number) {
  return Math.hypot(x - LAKE.x, z - LAKE.z);
}

export function getTerrainHeight(x: number, z: number) {
  // Building pads: dampen terrain height toward 0 inside each zone with ~8u falloff.
  let flatFactor = 1;
  for (const zone of FLAT_ZONES) {
    const d = Math.hypot(x - zone.x, z - zone.z);
    flatFactor = Math.min(flatFactor, smoothstep(zone.radius, zone.radius + FLAT_FALLOFF, d));
  }
  if (flatFactor === 0) return 0;
  const distance = Math.hypot(x, z);
  const rise = smoothstep(CAMPUS_RADIUS, CAMPUS_RADIUS + 20, distance);
  if (rise === 0) return 0;

  const hills = (fbm(x, z, 4, 0.018) * 0.5 + 0.5) * 5;
  const range = ridged(x, z, 6, 0.006);
  let massif = 0;
  for (const peak of PEAKS) {
    const d = Math.hypot(x - peak.x, z - peak.z) / peak.radius;
    massif += peak.height * Math.exp(-d * d * 2.2);
  }
  const mountains = smoothstep(45, 130, distance) * (range * range * 70 + massif * (0.55 + range * 0.9));
  const height = rise * (hills + mountains) * flatFactor;

  const lakeMask = 1 - smoothstep(LAKE.radius * 0.35, LAKE.radius, distanceToLake(x, z));
  return height * (1 - lakeMask) - 3.5 * lakeMask;
}

export function getTerrainNormal(x: number, z: number, target = new THREE.Vector3()) {
  const e = 0.5;
  const hl = getTerrainHeight(x - e, z);
  const hr = getTerrainHeight(x + e, z);
  const hd = getTerrainHeight(x, z - e);
  const hu = getTerrainHeight(x, z + e);
  return target.set(hl - hr, 2 * e, hd - hu).normalize();
}

const PALETTE = {
  lawn: new THREE.Color("#5d8c3e"),
  grass: new THREE.Color("#4c7a35"),
  dryGrass: new THREE.Color("#8d8b4a"),
  forest: new THREE.Color("#35552a"),
  rock: new THREE.Color("#77706a"),
  darkRock: new THREE.Color("#4b4744"),
  snow: new THREE.Color("#f2f5fa"),
  sand: new THREE.Color("#b9a77a"),
  mud: new THREE.Color("#5d533f"),
};

const scratch = new THREE.Color();
const scratchRock = new THREE.Color();

export function terrainColor(x: number, z: number, height: number, normalY: number, target: THREE.Color) {
  const slope = 1 - normalY;
  const variation = fbm(x + 400, z - 250, 3, 0.04) * 0.5 + 0.5;
  const fine = noise.noise(x * 0.35, z * 0.35) * 0.5 + 0.5;
  const distance = Math.hypot(x, z);

  target.copy(PALETTE.grass).lerp(PALETTE.dryGrass, variation * 0.55);
  target.lerp(PALETTE.forest, smoothstep(0.55, 0.85, fbm(x, z, 3, 0.03) * 0.5 + 0.5) * 0.6);
  target.lerp(PALETTE.lawn, 1 - smoothstep(CAMPUS_RADIUS - 2, CAMPUS_RADIUS + 6, distance));

  scratchRock.copy(PALETTE.rock).lerp(PALETTE.darkRock, fine * 0.7);
  const rockAmount = Math.max(
    smoothstep(0.2, 0.42, slope),
    smoothstep(TREE_LINE - 4, TREE_LINE + 14, height) * 0.9,
  );
  target.lerp(scratchRock, rockAmount);

  const snowLine = SNOW_LINE + (variation - 0.5) * 16;
  const snowAmount = smoothstep(snowLine, snowLine + 8, height) * (1 - smoothstep(0.42, 0.7, slope));
  target.lerp(PALETTE.snow, snowAmount);

  const shore = 1 - smoothstep(WATER_LEVEL + 0.2, WATER_LEVEL + 1.4, height);
  if (shore > 0) {
    scratch.copy(PALETTE.sand).lerp(PALETTE.mud, smoothstep(WATER_LEVEL, WATER_LEVEL - 1.5, height));
    target.lerp(scratch, shore);
  }
  return target;
}

export function createTileableNoiseCanvas(
  size: number,
  pixel: (u: number, v: number) => [number, number, number],
) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x / size, y / size);
      const i = (y * size + x) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

export function tileableNoise(u: number, v: number, frequency: number, octaves: number) {
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  let radius = frequency;
  for (let i = 0; i < octaves; i += 1) {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 2;
    sum += amplitude * noise.noise4d(
      Math.cos(a) * radius + i * 13.1,
      Math.sin(a) * radius,
      Math.cos(b) * radius,
      Math.sin(b) * radius + i * 7.7,
    );
    norm += amplitude;
    amplitude *= 0.5;
    radius *= 2;
  }
  return sum / norm;
}
