"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import type { CharacterDefinition } from "@/content/characters";

export type LimbRefs = {
  body: THREE.Group | null;
  leftLeg: THREE.Group | null;
  rightLeg: THREE.Group | null;
  leftArm: THREE.Group | null;
  rightArm: THREE.Group | null;
  head: THREE.Group | null;
};

/** Low-poly stylized engineer — shared by the player, NPCs and registration previews. */
export const CharacterModel = forwardRef<LimbRefs, { character: CharacterDefinition; shadow?: boolean }>(
  function CharacterModel({ character, shadow = true }, ref) {
    const body = useRef<THREE.Group>(null);
    const leftLeg = useRef<THREE.Group>(null);
    const rightLeg = useRef<THREE.Group>(null);
    const leftArm = useRef<THREE.Group>(null);
    const rightArm = useRef<THREE.Group>(null);
    const head = useRef<THREE.Group>(null);

    useImperativeHandle(ref, () => ({
      body: body.current,
      leftLeg: leftLeg.current,
      rightLeg: rightLeg.current,
      leftArm: leftArm.current,
      rightArm: rightArm.current,
      head: head.current,
    }));

    const p = character.palette;
    const legX = 0.13 * character.hip;
    const armX = 0.32 * character.shoulder;

    return (
      <>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.18} depthWrite={false} />
        </mesh>
        <group ref={body}>
          <group ref={leftLeg} position={[-legX, 0.86, 0]}>
            <mesh position={[0, -0.4, 0]} castShadow={shadow}>
              <capsuleGeometry args={[0.095, 0.62, 6, 12]} />
              <meshStandardMaterial color={p.pants} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.82, 0.07]} castShadow={shadow}>
              <boxGeometry args={[0.17, 0.11, 0.32]} />
              <meshStandardMaterial color={p.shoes} roughness={0.7} />
            </mesh>
          </group>
          <group ref={rightLeg} position={[legX, 0.86, 0]}>
            <mesh position={[0, -0.4, 0]} castShadow={shadow}>
              <capsuleGeometry args={[0.095, 0.62, 6, 12]} />
              <meshStandardMaterial color={p.pants} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.82, 0.07]} castShadow={shadow}>
              <boxGeometry args={[0.17, 0.11, 0.32]} />
              <meshStandardMaterial color={p.shoes} roughness={0.7} />
            </mesh>
          </group>
          <mesh position={[0, 1.2, 0]} castShadow={shadow}>
            <capsuleGeometry args={[0.24, 0.42, 8, 16]} />
            <meshStandardMaterial color={p.jacket} roughness={0.75} />
          </mesh>
          <mesh position={[0, 1.18, 0.235]}>
            <boxGeometry args={[0.04, 0.5, 0.02]} />
            <meshStandardMaterial color={p.accent} emissive={p.accent} emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 1.22, -0.27]} castShadow={shadow}>
            <boxGeometry args={[0.36, 0.46, 0.18]} />
            <meshStandardMaterial color="#3b3f45" roughness={0.85} />
          </mesh>
          <group ref={leftArm} position={[-armX, 1.5, 0]}>
            <mesh position={[0, -0.3, 0]} rotation={[0, 0, 0.06]} castShadow={shadow}>
              <capsuleGeometry args={[0.075, 0.5, 6, 12]} />
              <meshStandardMaterial color={p.jacket} roughness={0.75} />
            </mesh>
            <mesh position={[0.02, -0.64, 0]} castShadow={shadow}>
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color={p.skin} roughness={0.8} />
            </mesh>
          </group>
          <group ref={rightArm} position={[armX, 1.5, 0]}>
            <mesh position={[0, -0.3, 0]} rotation={[0, 0, -0.06]} castShadow={shadow}>
              <capsuleGeometry args={[0.075, 0.5, 6, 12]} />
              <meshStandardMaterial color={p.jacket} roughness={0.75} />
            </mesh>
            <mesh position={[-0.02, -0.64, 0]} castShadow={shadow}>
              <sphereGeometry args={[0.075, 12, 10]} />
              <meshStandardMaterial color={p.skin} roughness={0.8} />
            </mesh>
          </group>
          <mesh position={[0, 1.62, 0]} castShadow={shadow}>
            <cylinderGeometry args={[0.08, 0.09, 0.12, 12]} />
            <meshStandardMaterial color={p.skin} roughness={0.8} />
          </mesh>
          <group ref={head}>
            <mesh position={[0, 1.84, 0]} castShadow={shadow}>
              <sphereGeometry args={[0.2, 24, 18]} />
              <meshStandardMaterial color={p.skin} roughness={0.75} />
            </mesh>
            {character.hair === "short" && (
              <mesh position={[0, 1.93, -0.02]} castShadow={shadow}>
                <sphereGeometry args={[0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
                <meshStandardMaterial color={p.hair} roughness={0.95} />
              </mesh>
            )}
            {character.hair === "ponytail" && (
              <>
                <mesh position={[0, 1.93, -0.02]} castShadow={shadow}>
                  <sphereGeometry args={[0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
                <mesh position={[0, 1.72, -0.24]} rotation={[0.35, 0, 0]} castShadow={shadow}>
                  <capsuleGeometry args={[0.07, 0.3, 6, 10]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
              </>
            )}
            {character.hair === "bun" && (
              <>
                <mesh position={[0, 1.94, -0.02]} castShadow={shadow}>
                  <sphereGeometry args={[0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
                <mesh position={[0, 1.98, -0.2]} castShadow={shadow}>
                  <sphereGeometry args={[0.09, 12, 10]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
              </>
            )}
            {character.hair === "long" && (
              <>
                <mesh position={[0, 1.9, -0.05]} castShadow={shadow}>
                  <sphereGeometry args={[0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
                <mesh position={[0, 1.6, -0.18]} castShadow={shadow}>
                  <boxGeometry args={[0.34, 0.55, 0.12]} />
                  <meshStandardMaterial color={p.hair} roughness={0.95} />
                </mesh>
              </>
            )}
            <mesh position={[0, 1.86, 0.17]}>
              <boxGeometry args={[0.26, 0.06, 0.06]} />
              <meshStandardMaterial
                color="#0f172a"
                metalness={0.6}
                roughness={0.2}
                emissive={p.accent}
                emissiveIntensity={0.25}
              />
            </mesh>
          </group>
        </group>
      </>
    );
  },
);
