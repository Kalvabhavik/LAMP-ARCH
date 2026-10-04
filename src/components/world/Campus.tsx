"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { WORLD_STATIONS } from "@/content/stations";
import { COMPANIES } from "@/content/quest/companies";
import { KIOSKS } from "@/content/quest/kiosks";
import { COMPANY_SITES, companyObstacles } from "@/content/quest/sites";
import { clientMilestoneAllowed, MILESTONE } from "@/lib/game/progression";
import { playSfx } from "@/lib/audio/sfx";
import { cameraState, isTypingTarget, playerState } from "@/lib/world/runtime";
import { useGameStore } from "@/stores/game-store";
import { useQuestStore } from "@/stores/quest-store";
import { Atmosphere } from "@/components/world/Atmosphere";
import { CameraRig } from "@/components/world/CameraRig";
import { CompanyBuilding } from "@/components/world/CompanyBuilding";
import { Crystals } from "@/components/world/Crystals";
import { House, HOUSE_OBSTACLES, isInsideHouse } from "@/components/world/House";
import { MagicBox, MAGIC_BOX_POSITION } from "@/components/world/MagicBox";
import { Npc } from "@/components/world/Npc";
import { Player, STATION_OBSTACLES, type Obstacle, type WalkRequest } from "@/components/world/Player";
import { StationPad } from "@/components/world/StationPad";
import { Terrain } from "@/components/world/Terrain";
import type { StationId } from "@/types/game";

const INTERACT_DISTANCE = 4.5;

const TREE_POSITIONS: [number, number, number][] = [
  [-14, -7, 1.15],
  [13, -11, 0.9],
  [-13, 11, 0.85],
  [14, 8, 1.2],
  [-4, -14, 0.72],
  [-19, 3, 1.1],
  [20, -4, 0.95],
  [-9, 15, 0.9],
  [9, 15, 1.0],
  [7, -21, 1.1],
];

const LAMP_POSTS: [number, number][] = [-21, -13, 13, 21].flatMap((offset) => [
  [2.75, offset],
  [-2.75, offset],
  [offset, 2.75],
  [offset, -2.75],
]) as [number, number][];

function CampusTree({ position, scale }: { position: [number, number, number]; scale: number }) {
  const clusters: [number, number, number, number, string][] = [
    [0, 2.9, 0, 1.25, "#4c7a3d"],
    [0.75, 3.25, 0.25, 0.85, "#5f8c45"],
    [-0.7, 3.1, -0.2, 0.9, "#426d36"],
    [0.1, 3.75, -0.35, 0.8, "#6a9a4c"],
    [-0.25, 3.35, 0.7, 0.75, "#527f3e"],
  ];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.28, 2.4, 9]} />
        <meshStandardMaterial color="#5e4632" roughness={1} />
      </mesh>
      <mesh position={[0.3, 2.1, 0]} rotation={[0, 0, -0.7]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 1, 6]} />
        <meshStandardMaterial color="#5e4632" roughness={1} />
      </mesh>
      {clusters.map(([x, y, z, r, color], index) => (
        <mesh key={index} position={[x, y, z]} castShadow receiveShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={color} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function Road({
  position,
  length,
  rotation,
  width = 5.2,
}: {
  position: [number, number];
  length: number;
  rotation: number;
  width?: number;
}) {
  const inner = width * 0.73;
  const dashes = Math.floor(length / 4);
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#b3aea4" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[inner, length]} />
        <meshStandardMaterial color="#3f4447" roughness={0.92} />
      </mesh>
      {[-inner / 2, inner / 2].map((x) => (
        <mesh key={x} position={[x, 0.06, 0]} receiveShadow>
          <boxGeometry args={[0.14, 0.1, length]} />
          <meshStandardMaterial color="#c9c6bf" roughness={0.9} />
        </mesh>
      ))}
      {Array.from({ length: dashes }, (_, i) => -length / 2 + 2 + i * 4).map((z) => (
        <mesh key={z} position={[0, 0.026, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 2]} />
          <meshStandardMaterial color="#e9dfae" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function LampPost({ position, night }: { position: [number, number]; night: boolean }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 3, 8]} />
        <meshStandardMaterial color="#2f3438" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.17, 12, 10]} />
        <meshStandardMaterial color="#fff6d8" emissive="#ffd38a" emissiveIntensity={night ? 3 : 0.15} />
      </mesh>
    </group>
  );
}

function Plaza() {
  return (
    <group>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.4, 64]} />
        <meshStandardMaterial color="#9aa0a2" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.1, 4.4, 64]} />
        <meshStandardMaterial color="#6e7476" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Arch + sign welcoming players to the Introduction Hub. */
function HubSign({ night }: { night: boolean }) {
  return (
    <group position={[0, 0, 6.5]}>
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} position={[x, 1.8, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.18, 3.6, 10]} />
          <meshStandardMaterial color="#166e5a" metalness={0.5} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 3.6, 0]} castShadow>
        <boxGeometry args={[5.6, 0.9, 0.3]} />
        <meshStandardMaterial color="#0f172a" emissive="#34d399" emissiveIntensity={night ? 0.9 : 0.4} />
      </mesh>
      <Text
        position={[0, 3.62, 0.17]}
        fontSize={0.32}
        maxWidth={5.2}
        color="#a7f3d0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#022c22"
      >
        INTRODUCTION HUB
      </Text>
      <Text
        position={[0, 3.62, -0.17]}
        rotation={[0, Math.PI, 0]}
        fontSize={0.32}
        maxWidth={5.2}
        color="#a7f3d0"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#022c22"
      >
        INTRODUCTION HUB
      </Text>
    </group>
  );
}

/** Small pedestal + floating label — interactable info kiosk. */
function Kiosk({ kiosk }: { kiosk: (typeof KIOSKS)[number] }) {
  const ring = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 2) * 0.3;
  });
  return (
    <group position={[kiosk.position[0], 0, kiosk.position[1]]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.55, 1.1, 10]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.15, 0]} rotation={[-0.5, 0, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.6]} />
        <meshStandardMaterial
          ref={ring}
          color="#0f172a"
          emissive={kiosk.accent}
          emissiveIntensity={0.8}
        />
      </mesh>
      <Billboard position={[0, 2, 0]}>
        <Text fontSize={0.26} color="#e2e8f0" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#020617">
          {kiosk.title}
        </Text>
      </Billboard>
    </group>
  );
}

function InteractPrompt({ label }: { label: string | null }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(playerState.position.x, playerState.position.y + 2.6, playerState.position.z);
  });
  return (
    <group ref={group} visible={label !== null}>
      <Billboard>
        <Text fontSize={0.28} color="#fde68a" anchorX="center" anchorY="middle" outlineWidth={0.04} outlineColor="#111827">
          {label ?? ""}
        </Text>
      </Billboard>
    </group>
  );
}

type Interactable = {
  id: string;
  position: [number, number];
  radius: number;
  label: string;
  enabled: boolean;
  onInteract: () => void;
};

function zoneOf(x: number, z: number): string {
  if (isInsideHouse(x, z)) return "house";
  const bf = COMPANY_SITES.byteforge.lobby;
  if (x > bf.minX && x < bf.maxX && z > bf.minZ && z < bf.maxZ) return "byteforge";
  const nc = COMPANY_SITES.nexacore.lobby;
  if (x > nc.minX && x < nc.maxX && z > nc.minZ && z < nc.maxZ) return "nexacore";
  if (Math.hypot(x, z) < 10) return "intro_hub";
  if (Math.hypot(x, z - 21) < 12) return "home_exterior";
  return "outdoor";
}

function spawnFor(state: ReturnType<typeof useQuestStore.getState>["state"], isNew: boolean): [number, number, number] {
  if (isNew || !state) return [0, 12, Math.PI];
  switch (state.player.currentLocation) {
    case "house":
      return [0, 19.4, Math.PI];
    case "intro_hub":
      return [0, 6, Math.PI];
    case "byteforge":
      return [-31.5, 0, -Math.PI / 2];
    case "nexacore":
      return [31.5, -4, Math.PI / 2];
    case "home_exterior":
      return [0, 14, Math.PI];
    default:
      return [0, 12, Math.PI];
  }
}

export function Campus() {
  const activeStationId = useGameStore((state) => state.activeStationId);
  const panel = useGameStore((state) => state.panel);
  const openStation = useGameStore((state) => state.openStation);
  const timeOfDay = useGameStore((state) => state.timeOfDay);
  const questOverlay = useQuestStore((state) => state.overlay);
  const gameState = useQuestStore((state) => state.state);
  const isNewPlayer = useQuestStore((state) => state.isNewPlayer);
  const [walkRequest, setWalkRequest] = useState<WalkRequest | null>(null);
  const [nearbyLabel, setNearbyLabel] = useState<string | null>(null);
  const nearbyRef = useRef<Interactable | null>(null);
  const requestCounter = useRef(0);
  const hubIntroShown = useRef(false);
  const frozen = panel !== "none" || questOverlay !== "none";
  const night = timeOfDay === "night";

  const milestones = useMemo(() => new Set(gameState?.milestones ?? []), [gameState]);
  const unlockedCompanies = useMemo(() => new Set(gameState?.quest.unlockedCompanies ?? []), [gameState]);

  const spawn = useMemo(() => {
    const [x, z] = spawnFor(gameState, isNewPlayer);
    return [x, z] as [number, number];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply the spawn point/heading + camera once (mutating shared runtime state).
  useEffect(() => {
    const [x, z, heading] = spawnFor(useQuestStore.getState().state, useQuestStore.getState().isNewPlayer);
    playerState.position.set(x, 0, z);
    playerState.heading = heading;
    cameraState.yaw = heading + Math.PI;
  }, []);

  const characterId =
    gameState?.player.gender === "female" ? "engineer-female" : "engineer-male";

  const quest = useQuestStore;

  const walkToStation = useCallback(
    (stationId: StationId) => {
      const station = WORLD_STATIONS.find((candidate) => candidate.id === stationId);
      if (!station) return;
      requestCounter.current += 1;
      setWalkRequest({ id: requestCounter.current, targetId: stationId, position: station.position });
    },
    [],
  );

  const openMagicBox = useCallback(() => {
    playSfx("chime");
    const store = quest.getState();
    if (!store.state?.milestones.includes(MILESTONE.foundMagicBox)) {
      void store.postMilestone(MILESTONE.foundMagicBox);
    }
    store.openOverlay("magic_box");
  }, [quest]);

  const interactables = useMemo<Interactable[]>(() => {
    const list: Interactable[] = WORLD_STATIONS.map((station) => ({
      id: `station:${station.id}`,
      position: [station.position[0], station.position[2]] as [number, number],
      radius: INTERACT_DISTANCE,
      label: station.id === "lamp" ? "Press E to enter the Introduction Hub" : `Press E to enter ${station.title}`,
      enabled: true,
      onInteract: () => quest.getState().openOverlay("site", { siteId: station.id }),
    }));
    list.push({
      id: "hub_arch",
      position: [0, 6.5],
      radius: 2.4,
      label: "Press E to enter the Introduction Hub",
      enabled: true,
      onInteract: () => quest.getState().openOverlay("site", { siteId: "lamp" }),
    });
    list.push({
      id: "magic_box",
      position: MAGIC_BOX_POSITION,
      radius: 2.2,
      label: "Press E — open the Magic Box",
      enabled: milestones.has(MILESTONE.enteredHome),
      onInteract: openMagicBox,
    });
    for (const kiosk of KIOSKS) {
      list.push({
        id: `kiosk:${kiosk.id}`,
        position: kiosk.position,
        radius: kiosk.radius,
        label: `Press E — ${kiosk.title} info`,
        enabled: true,
        onInteract: () => quest.getState().openOverlay("info", kiosk),
      });
    }
    for (const company of COMPANIES) {
      const site = COMPANY_SITES[company.id];
      if (!site) continue;
      const unlocked = unlockedCompanies.has(company.id);
      list.push({
        id: `npc:${company.manager.npcId}`,
        position: site.npc.position,
        radius: 2.8,
        label: `Press E to talk to ${company.manager.name}`,
        enabled: unlocked,
        onInteract: () =>
          quest.getState().openOverlay("dialogue", { npcId: company.manager.npcId, companyId: company.id }),
      });
    }
    return list.filter((item) => item.enabled);
  }, [unlockedCompanies, milestones, openMagicBox, quest]);

  const obstacles = useMemo<Obstacle[]>(() => {
    const list: Obstacle[] = [
      ...STATION_OBSTACLES,
      ...HOUSE_OBSTACLES,
      ...TREE_POSITIONS.map(([x, z]) => ({ x, z, radius: 0.6 })),
      ...LAMP_POSTS.map(([x, z]) => ({ x, z, radius: 0.25 })),
      { x: 0, z: 6.5, radius: 0.4 }, // hub sign posts area
      { x: -2.4, z: 6.5, radius: 0.35 },
      { x: 2.4, z: 6.5, radius: 0.35 },
      { x: MAGIC_BOX_POSITION[0], z: MAGIC_BOX_POSITION[1], radius: 0.7 },
      ...KIOSKS.map((k) => ({ x: k.position[0], z: k.position[1], radius: 0.6 })),
    ];
    for (const company of COMPANIES) {
      const site = COMPANY_SITES[company.id];
      if (site) list.push(...companyObstacles(site, !unlockedCompanies.has(company.id)));
    }
    return list;
  }, [unlockedCompanies]);

  useEffect(() => {
    const handleTravel = (event: Event) => {
      const stationId = (event as CustomEvent<{ stationId?: StationId }>).detail?.stationId;
      if (stationId) walkToStation(stationId);
    };
    window.addEventListener("lampquest:travel", handleTravel);
    return () => window.removeEventListener("lampquest:travel", handleTravel);
  }, [walkToStation]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "KeyE" || frozen || isTypingTarget(event.target)) return;
      nearbyRef.current?.onInteract();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [frozen]);

  // Zone tracking → location sync + entry milestones.
  const lastZone = useRef<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const store = quest.getState();
      if (store.status !== "ready" || !store.state) return;
      const zone = zoneOf(playerState.position.x, playerState.position.z);
      if (zone === lastZone.current) return;
      lastZone.current = zone;
      void store.setLocation(zone);
      const have = new Set(store.state.milestones);
      const tryPost = (key: string) => {
        if (!have.has(key) && clientMilestoneAllowed(have, key) === "ok") void store.postMilestone(key);
      };
      if (zone === "house") tryPost(MILESTONE.enteredHome);
      if (zone === "intro_hub") {
        tryPost(MILESTONE.visitedIntroHub);
        if (
          have.has(MILESTONE.foundMagicBox) &&
          !have.has(MILESTONE.companyJoined("byteforge")) &&
          !hubIntroShown.current &&
          store.overlay === "none"
        ) {
          hubIntroShown.current = true;
          store.openOverlay("hub_intro");
        }
      }
      for (const company of COMPANIES) {
        if (zone === company.id) tryPost(MILESTONE.companyJoined(company.id));
      }
    }, 500);
    return () => clearInterval(timer);
  }, [quest]);

  useFrame(() => {
    let closest: Interactable | null = null;
    let closestDistance = Infinity;
    if (!frozen) {
      for (const item of interactables) {
        const distance = Math.hypot(playerState.position.x - item.position[0], playerState.position.z - item.position[1]);
        if (distance < item.radius && distance < closestDistance) {
          closestDistance = distance;
          closest = item;
        }
      }
    }
    if (nearbyRef.current?.id !== closest?.id) {
      nearbyRef.current = closest;
      setNearbyLabel(closest?.label ?? null);
    } else if (closest && nearbyLabel !== closest.label) {
      setNearbyLabel(closest.label);
    }
  });

  return (
    <>
      <Atmosphere timeOfDay={timeOfDay} />
      <Terrain />
      {/* main roads: east–west reaches both company sites; north–south stops at the house path */}
      <Road position={[0, 0]} length={62} rotation={Math.PI / 2} />
      <Road position={[0, -4]} length={38} rotation={0} />
      {/* garden path to the front door */}
      <Road position={[0, 15]} length={4} rotation={0} width={2.2} />
      <Plaza />

      {TREE_POSITIONS.map(([x, z, scale], index) => (
        <CampusTree key={index} position={[x, 0, z]} scale={scale} />
      ))}
      {LAMP_POSTS.map((position, index) => (
        <LampPost key={index} position={position} night={night} />
      ))}

      <HubSign night={night} />
      {KIOSKS.map((kiosk) => (
        <Kiosk key={kiosk.id} kiosk={kiosk} />
      ))}

      {WORLD_STATIONS.map((station) => (
        <StationPad
          key={station.id}
          station={station}
          unlocked={true}
          active={activeStationId === station.id}
          night={night}
          onSelect={() => walkToStation(station.id)}
        />
      ))}

      <House night={night} />
      <MagicBox opened={milestones.has(MILESTONE.foundMagicBox)} />

      {COMPANIES.map((company) => {
        const site = COMPANY_SITES[company.id];
        if (!site) return null;
        const unlocked = unlockedCompanies.has(company.id);
        return (
          <group key={company.id}>
            <CompanyBuilding company={company} site={site} locked={!unlocked} night={night} />
            {unlocked && (
              <Npc npcId={company.manager.npcId} position={site.npc.position} rotation={site.npc.rotation} />
            )}
          </group>
        );
      })}

      <Crystals />
      <InteractPrompt label={frozen ? null : nearbyLabel} />

      <Player
        request={walkRequest}
        frozen={frozen}
        obstacles={obstacles}
        characterId={characterId}
        spawn={spawn}
        nameTag={questOverlay === "dialogue" ? undefined : gameState?.player.name}
        onArrive={(targetId) => {
          setWalkRequest(null);
          openStation(targetId as StationId);
        }}
        onCancelRequest={() => setWalkRequest(null)}
      />
      <CameraRig />
    </>
  );
}
