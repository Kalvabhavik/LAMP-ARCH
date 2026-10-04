"use client";

import { Canvas } from "@react-three/fiber";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { characterForGender } from "@/content/characters";
import { CharacterModel } from "@/components/world/CharacterModel";

function Spinning({ gender }: { gender: "male" | "female" }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.9;
  });
  return (
    <group ref={group} position={[0, -1.05, 0]}>
      <CharacterModel character={characterForGender(gender)} shadow={false} />
    </group>
  );
}

export default function CharacterPreview({ gender }: { gender: "male" | "female" }) {
  return (
    <Canvas camera={{ position: [0, 0.6, 3.1], fov: 40 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 4, 4]} intensity={1.4} />
      <pointLight position={[-2, 1, 2]} intensity={6} color={gender === "female" ? "#f0abfc" : "#22d3ee"} />
      <Spinning gender={gender} />
    </Canvas>
  );
}
