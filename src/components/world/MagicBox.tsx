"use client";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { playerState } from "@/lib/world/runtime";

export const MAGIC_BOX_POSITION: [number, number] = [3.9, 24.1];

/** The Magic Box tucked into the back-room corner behind the bookshelf. */
export function MagicBox({ opened }: { opened: boolean }) {
  const lid = useRef<THREE.Group>(null);
  const glow = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const lidAngle = useRef(0);
  const near = useRef(false);
  const sparkleGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const d = Math.hypot(playerState.position.x - MAGIC_BOX_POSITION[0], playerState.position.z - MAGIC_BOX_POSITION[1]);
    near.current = d < 6;
    if (sparkleGroup.current) sparkleGroup.current.visible = opened || near.current;
    const target = opened ? -1.9 : 0;
    lidAngle.current += (target - lidAngle.current) * 0.07;
    if (lid.current) lid.current.rotation.x = lidAngle.current;
    const pulse = 0.7 + Math.sin(t * 2.4) * 0.3;
    if (glow.current) glow.current.emissiveIntensity = (opened ? 1.6 : 0.9) * pulse;
    if (light.current) light.current.intensity = (opened ? 4.5 : 1.6) * pulse;
  });

  return (
    <group position={[MAGIC_BOX_POSITION[0], 0, MAGIC_BOX_POSITION[1]]}>
      {/* pedestal */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.6, 0.7, 12]} />
        <meshStandardMaterial color="#3b2f4f" roughness={0.8} />
      </mesh>
      {/* box body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.7, 0.42, 0.5]} />
        <meshStandardMaterial
          ref={glow}
          color="#43307a"
          roughness={0.4}
          metalness={0.4}
          emissive="#8b5cf6"
          emissiveIntensity={1}
        />
      </mesh>
      {/* lid, hinged at back edge */}
      <group ref={lid} position={[0, 1.12, -0.25]}>
        <mesh position={[0, 0.06, 0.25]} castShadow>
          <boxGeometry args={[0.72, 0.12, 0.5]} />
          <meshStandardMaterial color="#5b4599" roughness={0.4} metalness={0.4} emissive="#a78bfa" emissiveIntensity={0.5} />
        </mesh>
      </group>
      {/* inner glow slit */}
      <mesh position={[0, 1.1, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.4]} />
        <meshStandardMaterial color="#e9d5ff" emissive="#c084fc" emissiveIntensity={opened ? 4 : 1.2} />
      </mesh>
      <pointLight ref={light} position={[0, 1.5, 0]} distance={6} color="#a78bfa" intensity={1.5} />
      <group ref={sparkleGroup} visible={false}>
        <Sparkles count={26} scale={[1.6, 2.2, 1.6]} position={[0, 1.4, 0]} size={4} speed={0.5} color="#d8b4fe" />
      </group>
    </group>
  );
}
