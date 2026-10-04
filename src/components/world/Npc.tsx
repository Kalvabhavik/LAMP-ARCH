"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { getCharacter } from "@/content/characters";
import { playerState } from "@/lib/world/runtime";
import { CharacterModel, type LimbRefs } from "./CharacterModel";

/** Stationary NPC: gentle idle breathing; head turns toward the player when near. */
export function Npc({
  npcId,
  position,
  rotation = 0,
  showName = true,
}: {
  npcId: string;
  position: [number, number];
  rotation?: number;
  showName?: boolean;
}) {
  const limbs = useRef<LimbRefs>(null);
  const character = getCharacter(npcId);

  useFrame(({ clock }) => {
    const l = limbs.current;
    if (!l?.body) return;
    const t = clock.elapsedTime;
    l.body.position.y = Math.sin(t * 1.6) * 0.02;
    l.body.rotation.x = 0;
    if (l.leftArm && l.rightArm) {
      l.leftArm.rotation.x = Math.sin(t * 1.6) * 0.05;
      l.rightArm.rotation.x = -Math.sin(t * 1.6) * 0.05;
    }
    if (l.head) {
      const dx = playerState.position.x - position[0];
      const dz = playerState.position.z - position[1];
      const dist = Math.hypot(dx, dz);
      let targetYaw = 0;
      if (dist < 6) {
        targetYaw = THREE.MathUtils.clamp(Math.atan2(dx, dz) - rotation, -1, 1);
      }
      l.head.rotation.y += (targetYaw - l.head.rotation.y) * 0.08;
    }
  });

  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
      <CharacterModel ref={limbs} character={character} />
      {showName && (
        <Billboard position={[0, 2.45, 0]}>
          <Text fontSize={0.2} color="#fde68a" anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#020617">
            {character.label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
