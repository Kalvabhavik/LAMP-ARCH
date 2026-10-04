"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import type { CompanyDefinition } from "@/content/quest/companies";
import type { CompanySite } from "@/content/quest/sites";
import { interiorState, playerState } from "@/lib/world/runtime";

function insideLobby(site: CompanySite, x: number, z: number) {
  const l = site.lobby;
  return x > l.minX && x < l.maxX && z > l.minZ && z < l.maxZ;
}

/**
 * Data-driven company HQ: walk-in lobby + office mass above/behind, emissive
 * sign, energy barrier while locked.
 */
export function CompanyBuilding({
  company,
  site,
  locked,
  night,
}: {
  company: CompanyDefinition;
  site: CompanySite;
  locked: boolean;
  night: boolean;
}) {
  const [cx, cz] = site.position;
  const [w, d] = site.size;
  const [inside, setInside] = useState(false);
  const [barrierGone, setBarrierGone] = useState(!locked);
  const barrier = useRef<THREE.Mesh>(null);
  const barrierMat = useRef<THREE.MeshStandardMaterial>(null);
  const dissolve = useRef(locked ? 0 : 1);
  const interiorId = company.id as "byteforge" | "nexacore";
  const doorX = site.doorSide === "east" ? cx + w / 2 : cx - w / 2;
  const doorFacing = site.doorSide === "east" ? 1 : -1;
  const half = site.doorWidth / 2;
  const lobbyHeight = 3.2;
  const towerHeight = site.floors * 2.6;

  const [camInside, setCamInside] = useState(false);

  useFrame(({ clock, camera }, delta) => {
    const inLobby = insideLobby(site, playerState.position.x, playerState.position.z);
    if (inLobby !== inside) setInside(inLobby);
    if (inLobby && interiorState.inside !== interiorId) interiorState.inside = interiorId;
    else if (!inLobby && interiorState.inside === interiorId) interiorState.inside = "none";
    // Camera occlusion: fade walls when the camera is inside the building shell
    // or hugging the door-side wall, so the player is never hidden behind glass.
    const camIn =
      insideLobby(site, camera.position.x, camera.position.z) ||
      Math.abs(camera.position.x - doorX) < 3;
    if (camIn !== camInside) setCamInside(camIn);
    if (!locked && dissolve.current < 1) {
      dissolve.current = Math.min(1, dissolve.current + delta * 0.8);
      if (dissolve.current >= 1) setBarrierGone(true);
    }
    if (barrierMat.current && dissolve.current < 1) {
      const base = inside || insideLobby(site, camera.position.x, camera.position.z) ? 0.08 : 0.45;
      barrierMat.current.opacity = (1 - dissolve.current) * (base + Math.sin(clock.elapsedTime * 3) * 0.1);
    }
  });

  const wallColor = company.id === "nexacore" ? "#1e293b" : "#57534e";
  const fade = inside || camInside;

  return (
    <group>
      {/* lobby floor */}
      <mesh position={[cx, 0.06, cz]} receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>

      {/* lobby walls (glass) */}
      {(["z0", "z1"] as const).map((side) => (
        <mesh key={side} position={[cx, lobbyHeight / 2, side === "z0" ? cz - d / 2 : cz + d / 2]} castShadow={!fade}>
          <boxGeometry args={[w + 0.5, lobbyHeight, 0.4]} />
          <meshStandardMaterial color={wallColor} roughness={0.6} transparent={fade} opacity={fade ? 0.18 : 1} />
        </mesh>
      ))}
      {/* solid wall (opposite the door) */}
      <mesh position={[site.doorSide === "east" ? cx - w / 2 : cx + w / 2, lobbyHeight / 2, cz]} castShadow={!fade}>
        <boxGeometry args={[0.4, lobbyHeight, d + 0.5]} />
        <meshStandardMaterial color={wallColor} roughness={0.6} transparent={fade} opacity={fade ? 0.18 : 1} />
      </mesh>
      {/* door wall segments */}
      {[
        [cz - d / 2, cz - half],
        [cz + half, cz + d / 2],
      ].map(([zA, zB], i) => (
        <mesh key={i} position={[doorX, lobbyHeight / 2, (zA + zB) / 2]} castShadow={!fade}>
          <boxGeometry args={[0.4, lobbyHeight, Math.max(0.2, zB - zA)]} />
          <meshStandardMaterial
            color={company.id === "nexacore" ? "#67e8f9" : "#94a3b8"}
            roughness={0.2}
            metalness={0.4}
            transparent
            opacity={fade ? 0.12 : 0.55}
          />
        </mesh>
      ))}
      {/* door header + frame */}
      <mesh position={[doorX, lobbyHeight - 0.4, cz]}>
        <boxGeometry args={[0.4, 0.8, site.doorWidth]} />
        <meshStandardMaterial color={company.color} emissive={company.color} emissiveIntensity={0.4} transparent={fade} opacity={fade ? 0.2 : 1} />
      </mesh>

      {/* tower mass above the lobby */}
      {!fade && (
        <mesh position={[cx, lobbyHeight + towerHeight / 2, cz]} castShadow>
          <boxGeometry args={[w * 0.92, towerHeight, d * 0.92]} />
          <meshStandardMaterial
            color={company.id === "nexacore" ? "#0f172a" : "#44403c"}
            roughness={0.35}
            metalness={0.55}
          />
        </mesh>
      )}
      {/* lobby ceiling slab always rendered thin when inside */}
      {fade && (
        <mesh position={[cx, lobbyHeight + 0.2, cz]}>
          <boxGeometry args={[w * 0.92, 0.3, d * 0.92]} />
          <meshStandardMaterial color="#0f172a" transparent opacity={0.35} />
        </mesh>
      )}
      {/* emissive window grid on the tower face */}
      {!fade &&
        Array.from({ length: site.floors }).map((_, floor) => (
          <mesh
            key={floor}
            position={[doorX + doorFacing * 0.1, lobbyHeight + 1.3 + floor * 2.6, cz]}
            rotation={[0, doorFacing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}
          >
            <planeGeometry args={[d * 0.7, 1.1]} />
            <meshStandardMaterial
              color="#0ea5e9"
              emissive={company.color}
              emissiveIntensity={night ? 0.9 : 0.35}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      {/* rooftop beacon */}
      <mesh position={[cx, lobbyHeight + towerHeight + 0.6, cz]}>
        <cylinderGeometry args={[0.08, 0.14, 1.2, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[cx, lobbyHeight + towerHeight + 1.3, cz]}>
        <sphereGeometry args={[0.22, 12, 10]} />
        <meshStandardMaterial color={company.color} emissive={company.color} emissiveIntensity={2} />
      </mesh>

      {/* interior: reception desk, plant, accent light */}
      <mesh position={[site.doorSide === "east" ? doorX - 3 : doorX + 3, 0.55, cz]} castShadow>
        <boxGeometry args={[1.1, 1.1, 4.4]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[site.doorSide === "east" ? doorX - 3 : doorX + 3, 1.12, cz]}>
        <boxGeometry args={[1.2, 0.06, 4.5]} />
        <meshStandardMaterial color={company.color} emissive={company.color} emissiveIntensity={0.5} />
      </mesh>
      <pointLight position={[cx, 2.4, cz]} intensity={inside ? 7 : 0} distance={10} color="#dff3ff" />

      {/* energy barrier while locked */}
      {!barrierGone && (
        <>
          <mesh ref={barrier} position={[doorX, lobbyHeight / 2, cz]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[site.doorWidth, lobbyHeight - 0.8]} />
            <meshStandardMaterial
              ref={barrierMat}
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={1.6}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
            />
          </mesh>
          <Billboard position={[doorX + doorFacing * 1.5, 3.6, cz]}>
            <Text fontSize={0.34} color="#fca5a5" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#450a0a">
              {`LOCKED — ${site.lockedHint}`}
            </Text>
          </Billboard>
        </>
      )}

      {/* sign + floating name */}
      <mesh position={[doorX + doorFacing * 0.15, lobbyHeight + 0.9, cz]} rotation={[0, doorFacing > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <planeGeometry args={[Math.min(9, d * 0.8), 0.9]} />
        <meshStandardMaterial color="#0f172a" emissive={company.color} emissiveIntensity={night ? 1.1 : 0.55} />
      </mesh>
      {!inside && (
        <Billboard position={[cx, lobbyHeight + 1.6, cz]}>
          <Text fontSize={0.32} color="#f8fafc" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#020617">
            {company.name.toUpperCase()}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
