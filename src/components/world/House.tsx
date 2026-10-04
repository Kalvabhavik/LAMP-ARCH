"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { interiorState, playerState } from "@/lib/world/runtime";
import type { Obstacle } from "./Player";

// House centered at (0,21): footprint x[-5,5] z[17,25], wall height 2.8,
// door gap 1.8 wide on the north wall (z=17) at x=0, partition at z=22 with a
// doorway at x≈-3 leading to the back room.
export const HOUSE_BOUNDS = { minX: -5, maxX: 5, minZ: 17, maxZ: 25 };

export const HOUSE_OBSTACLES: Obstacle[] = [
  // north wall (door x∈[-0.9,0.9] stays open)
  { kind: "box", minX: -5.2, maxX: -0.9, minZ: 16.8, maxZ: 17.3 },
  { kind: "box", minX: 0.9, maxX: 5.2, minZ: 16.8, maxZ: 17.3 },
  // south / west / east walls
  { kind: "box", minX: -5.2, maxX: 5.2, minZ: 24.7, maxZ: 25.2 },
  { kind: "box", minX: -5.2, maxX: -4.7, minZ: 17, maxZ: 25 },
  { kind: "box", minX: 4.7, maxX: 5.2, minZ: 17, maxZ: 25 },
  // partition z=22, doorway x∈[-3.7,-2.3]
  { kind: "box", minX: -5, maxX: -3.7, minZ: 21.85, maxZ: 22.15 },
  { kind: "box", minX: -2.3, maxX: 5, minZ: 21.85, maxZ: 22.15 },
  // furniture
  { kind: "box", minX: -4.4, maxX: -2.2, minZ: 18.2, maxZ: 19.6 }, // sofa
  { kind: "box", minX: 0.6, maxX: 2.6, minZ: 18.6, maxZ: 20 }, // table
  { kind: "box", minX: 3.4, maxX: 4.7, minZ: 19, maxZ: 21.6 }, // kitchen counter
  
  { kind: "box", minX: -0.5, maxX: 1, minZ: 24, maxZ: 24.7 }, // wardrobe
  { kind: "box", minX: 3.4, maxX: 4.7, minZ: 22.5, maxZ: 23.4 }, // bookshelf (hides the box)
];

export function isInsideHouse(x: number, z: number) {
  return x > HOUSE_BOUNDS.minX && x < HOUSE_BOUNDS.maxX && z > HOUSE_BOUNDS.minZ && z < HOUSE_BOUNDS.maxZ;
}

function Wall({ size, position, faded }: { size: [number, number, number]; position: [number, number, number]; faded: boolean }) {
  return (
    <mesh position={position} castShadow={!faded} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#8d7d6b" roughness={0.9} transparent={faded} opacity={faded ? 0.18 : 1} />
    </mesh>
  );
}

export function House({ night }: { night: boolean }) {
  const [inside, setInside] = useState(false);
  const [camBlocked, setCamBlocked] = useState(false);
  const wasInside = useRef(false);
  const wasBlocked = useRef(false);

  useFrame(({ camera }) => {
    const inHouse = isInsideHouse(playerState.position.x, playerState.position.z);
    if (inHouse !== wasInside.current) {
      wasInside.current = inHouse;
      setInside(inHouse);
    }
    if (inHouse !== (interiorState.inside === "house")) {
      interiorState.inside = inHouse ? "house" : interiorState.inside === "house" ? "none" : interiorState.inside;
    }
    // Hide the roof when it would block the view: player inside, or the camera
    // is under/inside the roof cone (which overhangs the walls by ~2.6 units).
    const blocked =
      inHouse ||
      (camera.position.y < 8 &&
        camera.position.x > -9 &&
        camera.position.x < 9 &&
        camera.position.z > 10 &&
        camera.position.z < 32);
    if (blocked !== wasBlocked.current) {
      wasBlocked.current = blocked;
      setCamBlocked(blocked);
    }
  });

  const f = inside;
  const hideRoof = inside || camBlocked;

  return (
    <group>
      {/* floor + rug */}
      <mesh position={[0, 0.06, 21]} receiveShadow>
        <boxGeometry args={[10, 0.12, 8]} />
        <meshStandardMaterial color="#a07850" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.13, 19.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.4, 2.6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={1} />
      </mesh>

      {/* walls */}
      <Wall size={[4.1, 2.8, 0.35]} position={[-2.95, 1.4, 17]} faded={f} />
      <Wall size={[4.1, 2.8, 0.35]} position={[2.95, 1.4, 17]} faded={f} />
      <Wall size={[10.4, 2.8, 0.35]} position={[0, 1.4, 25]} faded={f} />
      <Wall size={[0.35, 2.8, 8.4]} position={[-5, 1.4, 21]} faded={f} />
      <Wall size={[0.35, 2.8, 8.4]} position={[5, 1.4, 21]} faded={f} />
      {/* partition + its doorway lintel */}
      <Wall size={[1.3, 2.8, 0.3]} position={[-4.35, 1.4, 22]} faded={f} />
      <Wall size={[7.3, 2.8, 0.3]} position={[1.35, 1.4, 22]} faded={f} />
      <mesh position={[-3, 2.5, 22]}>
        <boxGeometry args={[1.4, 0.6, 0.3]} />
        <meshStandardMaterial color="#8d7d6b" roughness={0.9} transparent={f} opacity={f ? 0.18 : 1} />
      </mesh>
      {/* door lintel north */}
      <mesh position={[0, 2.5, 17]}>
        <boxGeometry args={[1.8, 0.6, 0.35]} />
        <meshStandardMaterial color="#8d7d6b" roughness={0.9} transparent={f} opacity={f ? 0.18 : 1} />
      </mesh>

      {/* roof — hidden while inside or while it blocks the camera */}
      {!hideRoof && (
        <group>
          <mesh position={[0, 3.25, 21]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[7.6, 1.4, 4]} />
            <meshStandardMaterial color="#5b3a2e" roughness={0.95} flatShading />
          </mesh>
        </group>
      )}

      {/* warm interior light */}
      <pointLight position={[0, 2.2, 20]} intensity={inside || night ? 6 : 0} distance={9} color="#ffd9a0" />
      <pointLight position={[-2, 2.2, 23.5]} intensity={inside ? 4 : 0} distance={7} color="#ffd9a0" />

      {/* living room: sofa, table, kitchen counter */}
      <mesh position={[-3.3, 0.35, 18.9]} castShadow>
        <boxGeometry args={[2.2, 0.55, 1.1]} />
        <meshStandardMaterial color="#3f5d7a" roughness={0.85} />
      </mesh>
      <mesh position={[-3.3, 0.85, 19.35]} castShadow>
        <boxGeometry args={[2.2, 0.6, 0.28]} />
        <meshStandardMaterial color="#35506b" roughness={0.85} />
      </mesh>
      <mesh position={[1.6, 0.4, 19.3]} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.08, 20]} />
        <meshStandardMaterial color="#6b4f35" roughness={0.8} />
      </mesh>
      <mesh position={[1.6, 0.2, 19.3]}>
        <cylinderGeometry args={[0.1, 0.14, 0.4, 10]} />
        <meshStandardMaterial color="#54402c" roughness={0.8} />
      </mesh>
      <mesh position={[4.05, 0.5, 20.3]} castShadow>
        <boxGeometry args={[1.3, 1, 2.6]} />
        <meshStandardMaterial color="#7d7468" roughness={0.7} />
      </mesh>
      <mesh position={[4.05, 1.05, 20.3]}>
        <boxGeometry args={[1.36, 0.1, 2.66]} />
        <meshStandardMaterial color="#e5e0d5" roughness={0.5} />
      </mesh>

      
      <mesh position={[0.25, 1.05, 24.35]} castShadow>
        <boxGeometry args={[1.4, 2.1, 0.6]} />
        <meshStandardMaterial color="#5e4632" roughness={0.9} />
      </mesh>
      <mesh position={[4.05, 1.25, 22.95]} castShadow>
        <boxGeometry args={[1.3, 2.5, 0.85]} />
        <meshStandardMaterial color="#4a3a2c" roughness={0.9} />
      </mesh>
      {[0.6, 1.2, 1.8].map((y) => (
        <mesh key={y} position={[4.05, y, 22.95]}>
          <boxGeometry args={[1.2, 0.05, 0.8]} />
          <meshStandardMaterial color="#3a2d21" roughness={0.9} />
        </mesh>
      ))}
      {[
        [3.75, 0.9, "#b3414a"],
        [4.2, 0.9, "#3f6db3"],
        [3.9, 1.5, "#b3893f"],
        [4.25, 2.1, "#4f8f5a"],
      ].map(([x, y, c], i) => (
        <mesh key={i} position={[x as number, y as number, 22.85]}>
          <boxGeometry args={[0.28, 0.5, 0.35]} />
          <meshStandardMaterial color={c as string} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
