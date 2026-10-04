"use client";

import { Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { WORLD_STATIONS } from "@/content/stations";
import { getCharacter } from "@/content/characters";
import { cameraState, isTypingTarget, playerState } from "@/lib/world/runtime";
import { PLAY_RADIUS, WATER_LEVEL, getTerrainHeight } from "@/lib/world/terrain";
import { CharacterModel, type LimbRefs } from "./CharacterModel";

export type WalkRequest = {
  id: number;
  targetId: string;
  position: [number, number, number];
};

/** Circle = soft avoid + hard block. Box = axis-aligned footprint, blocks movement (kept active for auto-walk). */
export type Obstacle =
  | { kind?: "circle"; x: number; z: number; radius: number }
  | { kind: "box"; minX: number; maxX: number; minZ: number; maxZ: number };

type PlayerProps = {
  request: WalkRequest | null;
  frozen: boolean;
  obstacles: Obstacle[];
  characterId: string;
  spawn: [number, number] | null;
  nameTag?: string;
  onArrive: (targetId: string) => void;
  onCancelRequest: () => void;
};

const WALK_SPEED = 4.6;
const RUN_SPEED = 9.5;
const JUMP_VELOCITY = 7;
const GRAVITY = 20;
const ARRIVE_DISTANCE = 3.3;
const MAX_CLIMB = 1.1;

type Keys = Record<"forward" | "back" | "left" | "right" | "sprint" | "jump", boolean>;

const KEY_BINDINGS: Record<string, keyof Keys> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
  Space: "jump",
};

function shortestAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function insideBox(o: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number, pad = 0.35) {
  return x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad;
}

function hitsObstacle(obstacle: Obstacle, x: number, z: number) {
  if (obstacle.kind === "box") return insideBox(obstacle, x, z);
  return Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius;
}

export function Player({ request, frozen, obstacles, characterId, spawn, nameTag, onArrive, onCancelRequest }: PlayerProps) {
  const root = useRef<THREE.Group>(null);
  const limbs = useRef<LimbRefs>(null);
  const keys = useRef<Keys>({ forward: false, back: false, left: false, right: false, sprint: false, jump: false });
  const velocity = useRef(new THREE.Vector3());
  const verticalVelocity = useRef(0);
  const stridePhase = useRef(0);
  const exhausted = useRef(false);
  const arrivedRequest = useRef<number | null>(null);
  const spawned = useRef(false);
  const character = getCharacter(characterId);

  useEffect(() => {
    const handle = (pressed: boolean) => (event: KeyboardEvent) => {
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      if (pressed && isTypingTarget(event.target)) return;
      if (action === "jump" && pressed) event.preventDefault();
      keys.current[action] = pressed;
    };
    const down = handle(true);
    const up = handle(false);
    const reset = () => {
      Object.keys(keys.current).forEach((key) => {
        keys.current[key as keyof Keys] = false;
      });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const group = root.current;
    if (!group) return;
    if (!spawned.current && spawn) {
      spawned.current = true;
      group.position.set(spawn[0], getTerrainHeight(spawn[0], spawn[1]), spawn[1]);
      playerState.position.copy(group.position);
    }
    if (playerState.teleport) {
      group.position.set(playerState.teleport.x, getTerrainHeight(playerState.teleport.x, playerState.teleport.z), playerState.teleport.z);
      playerState.teleport = null;
      velocity.current.set(0, 0, 0);
      verticalVelocity.current = 0;
      playerState.grounded = true;
    }
    const delta = Math.min(rawDelta, 0.05);
    const position = group.position;
    const input = keys.current;

    const inputX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const inputY = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const hasInput = !frozen && (inputX !== 0 || inputY !== 0);

    const desired = new THREE.Vector3();
    let targetSpeed = 0;
    let autoWalking = false;

    if (hasInput) {
      if (request) onCancelRequest();
      const yaw = cameraState.yaw;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      desired.addScaledVector(forward, inputY).addScaledVector(right, inputX).normalize();
      const wantsSprint = input.sprint && !exhausted.current && playerState.stamina > 0;
      targetSpeed = wantsSprint ? RUN_SPEED : WALK_SPEED;
      playerState.sprinting = wantsSprint;
    } else if (!frozen && request) {
      const dx = request.position[0] - position.x;
      const dz = request.position[2] - position.z;
      const distance = Math.hypot(dx, dz);
      playerState.sprinting = false;
      if (distance <= ARRIVE_DISTANCE) {
        if (arrivedRequest.current !== request.id) {
          arrivedRequest.current = request.id;
          onArrive(request.targetId);
        }
      } else {
        autoWalking = true;
        desired.set(dx / distance, 0, dz / distance);
        for (const obstacle of obstacles) {
          if (obstacle.kind === "box") continue;
          if (obstacle.x === request.position[0] && obstacle.z === request.position[2]) continue;
          const ox = position.x - obstacle.x;
          const oz = position.z - obstacle.z;
          const od = Math.hypot(ox, oz);
          const reach = obstacle.radius + 2.2;
          if (od < reach && od > 0.001) {
            const push = (reach - od) / reach;
            const side = Math.sign(desired.x * oz - desired.z * ox) || 1;
            desired.x += (ox / od) * push * 1.5 + (-oz / od) * side * push * 1.2;
            desired.z += (oz / od) * push * 1.5 + (ox / od) * side * push * 1.2;
          }
        }
        desired.normalize();
        targetSpeed = WALK_SPEED * 1.35;
      }
    } else {
      playerState.sprinting = false;
    }

    const moving = targetSpeed > 0;
    if (playerState.sprinting && moving) {
      playerState.stamina = Math.max(0, playerState.stamina - delta * 0.22);
      if (playerState.stamina === 0) exhausted.current = true;
    } else {
      playerState.stamina = Math.min(1, playerState.stamina + delta * 0.16);
      if (exhausted.current && playerState.stamina > 0.3) exhausted.current = false;
    }

    const blend = 1 - Math.exp(-delta * (moving ? 10 : 14));
    velocity.current.lerp(desired.multiplyScalar(targetSpeed), blend);

    const groundHere = getTerrainHeight(position.x, position.z);
    const blocked = (x: number, z: number) => {
      if (Math.hypot(x, z) > PLAY_RADIUS) return true;
      const ground = getTerrainHeight(x, z);
      if (ground < WATER_LEVEL + 0.15) return true;
      const step = Math.hypot(x - position.x, z - position.z);
      if (step > 0 && ground - groundHere > MAX_CLIMB * step && playerState.grounded) return true;
      return obstacles.some((obstacle) => {
        // Auto-walk steers around circle obstacles itself; box colliders (walls) always apply.
        if (autoWalking && obstacle.kind !== "box") return false;
        return hitsObstacle(obstacle, x, z);
      });
    };

    const stepX = velocity.current.x * delta;
    const stepZ = velocity.current.z * delta;
    if (!blocked(position.x + stepX, position.z + stepZ)) {
      position.x += stepX;
      position.z += stepZ;
    } else if (!blocked(position.x + stepX, position.z)) {
      position.x += stepX;
      velocity.current.z = 0;
    } else if (!blocked(position.x, position.z + stepZ)) {
      position.z += stepZ;
      velocity.current.x = 0;
    } else {
      velocity.current.set(0, 0, 0);
    }

    const ground = getTerrainHeight(position.x, position.z);
    if (playerState.grounded && input.jump && !frozen) {
      verticalVelocity.current = JUMP_VELOCITY;
      playerState.grounded = false;
      input.jump = false;
    }
    if (!playerState.grounded) {
      verticalVelocity.current -= GRAVITY * delta;
      position.y += verticalVelocity.current * delta;
      if (position.y <= ground) {
        position.y = ground;
        verticalVelocity.current = 0;
        playerState.grounded = true;
      }
    } else if (position.y - ground > 0.6) {
      playerState.grounded = false;
    } else {
      position.y = ground;
    }

    const speed = Math.hypot(velocity.current.x, velocity.current.z);
    if (speed > 0.3) {
      const heading = Math.atan2(velocity.current.x, velocity.current.z);
      group.rotation.y += shortestAngle(group.rotation.y, heading) * Math.min(1, delta * 12);
    }

    const speedFactor = Math.min(1, speed / RUN_SPEED);
    stridePhase.current += delta * (4 + speed * 1.15) * (speed > 0.2 ? 1 : 0);
    const swing = Math.sin(stridePhase.current) * (0.25 + speedFactor * 0.7) * Math.min(1, speed / 1.5);
    const airborne = !playerState.grounded;
    const l = limbs.current;
    if (l?.leftLeg && l.rightLeg && l.leftArm && l.rightArm && l.body) {
      l.leftLeg.rotation.x = airborne ? -0.6 : swing;
      l.rightLeg.rotation.x = airborne ? 0.3 : -swing;
      l.leftArm.rotation.x = airborne ? -1.1 : -swing * 0.9;
      l.rightArm.rotation.x = airborne ? -1.1 : swing * 0.9;
      l.body.position.y = airborne ? 0 : Math.abs(Math.cos(stridePhase.current)) * 0.06 * Math.min(1, speed / 2);
      l.body.rotation.x = speedFactor * 0.18;
    }

    playerState.position.copy(position);
    playerState.heading = group.rotation.y;
    playerState.speed = speed;
  });

  return (
    <group ref={root} name="lamp-player" position={[spawn?.[0] ?? 0, 0, spawn?.[1] ?? 6]} rotation={[0, Math.PI, 0]}>
      <CharacterModel ref={limbs} character={character} />
      {nameTag ? (
        <Billboard position={[0, 2.45, 0]}>
          <Text fontSize={0.22} color="#a5f3fc" anchorX="center" anchorY="middle" outlineWidth={0.015} outlineColor="#020617">
            {nameTag}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

export const STATION_OBSTACLES: Obstacle[] = WORLD_STATIONS.map((station) => ({
  x: station.position[0],
  z: station.position[2],
  radius: 2.4,
}));
