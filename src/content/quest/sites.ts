import type { CompanyId } from "@/types/mission";
import type { Obstacle } from "@/components/world/Player";

export type CompanySite = {
  companyId: CompanyId;
  /** Building center. */
  position: [number, number];
  /** Footprint (x,z). */
  size: [number, number];
  floors: number;
  /** Which side the door is on: "east" faces +x, "west" faces -x. */
  doorSide: "east" | "west";
  doorWidth: number;
  /** NPC stands behind the reception desk, in world coords. */
  npc: { position: [number, number]; rotation: number };
  /** Lobby interior bounds used for location tracking. */
  lobby: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Locked-barrier label referencing the company that must be completed first. */
  lockedHint: string;
};

export const COMPANY_SITES: Record<string, CompanySite> = {
  byteforge: {
    companyId: "byteforge",
    position: [-38, 0],
    size: [10, 8],
    floors: 2,
    doorSide: "east",
    doorWidth: 2,
    npc: { position: [-40.5, -1], rotation: Math.PI / 2 },
    lobby: { minX: -43, maxX: -33, minZ: -4, maxZ: 4 },
    lockedHint: "Visit the Introduction Hub first",
  },
  nexacore: {
    companyId: "nexacore",
    position: [40, -4],
    size: [14, 12],
    floors: 5,
    doorSide: "west",
    doorWidth: 2.4,
    npc: { position: [43, -4], rotation: -Math.PI / 2 },
    lobby: { minX: 33, maxX: 47, minZ: -10, maxZ: 2 },
    lockedHint: "Complete ByteForge Solutions",
  },
};

function wallBox(minX: number, maxX: number, minZ: number, maxZ: number): Obstacle {
  return { kind: "box", minX, maxX, minZ, maxZ };
}

/** Colliders for a company building: 4 walls with a door gap on `doorSide`, plus reception desk. */
export function companyObstacles(site: CompanySite, locked: boolean): Obstacle[] {
  const [cx, cz] = site.position;
  const [w, d] = site.size;
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const z0 = cz - d / 2;
  const z1 = cz + d / 2;
  const half = site.doorWidth / 2;
  const obstacles: Obstacle[] = [];
  // walls perpendicular to x-axis
  const xWall = (x: number) => wallBox(x - 0.25, x + 0.25, z0 - 0.2, z1 + 0.2);
  // walls perpendicular to z-axis
  const zWall = (z: number) => wallBox(x0 - 0.2, x1 + 0.2, z - 0.25, z + 0.25);

  const doorX = site.doorSide === "east" ? x1 : x0;
  const solidX = site.doorSide === "east" ? x0 : x1;
  obstacles.push(xWall(solidX));
  // door wall split around the gap centered at cz
  obstacles.push(
    wallBox(doorX - 0.25, doorX + 0.25, z0 - 0.2, cz - half),
    wallBox(doorX - 0.25, doorX + 0.25, cz + half, z1 + 0.2),
  );
  obstacles.push(zWall(z0), zWall(z1));
  if (locked) obstacles.push(wallBox(doorX - 0.8, doorX + 0.8, cz - half, cz + half));
  // reception desk behind the NPC, 2.5u in from the door wall
  const deskX = site.doorSide === "east" ? doorX - 3 : doorX + 3;
  obstacles.push(wallBox(deskX - 0.6, deskX + 0.6, cz - 2.2, cz + 2.2));
  return obstacles;
}
