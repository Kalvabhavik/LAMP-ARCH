"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cameraState, interiorState, playerState } from "@/lib/world/runtime";
import { clamp, getTerrainHeight } from "@/lib/world/terrain";

export function CameraRig() {
  const { camera, gl } = useThree();
  const focus = useRef(new THREE.Vector3());
  const goal = useRef(new THREE.Vector3());

  useEffect(() => {
    const element = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      cameraState.yaw -= (event.clientX - lastX) * 0.005;
      cameraState.pitch = clamp(cameraState.pitch + (event.clientY - lastY) * 0.004, 0.06, 1.25);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => {
      dragging = false;
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraState.distance = clamp(cameraState.distance * (1 + event.deltaY * 0.001), 4, 28);
    };

    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const { position } = playerState;
    focus.current.set(position.x, position.y + 1.5, position.z);
    // Interiors: keep the camera close and looking down so walls never block the view.
    const indoors = interiorState.inside !== "none";
    const ease = Math.min(1, delta * 3);
    if (indoors) {
      cameraState.distance += (Math.min(cameraState.distance, 7) - cameraState.distance) * ease;
      cameraState.pitch += (Math.max(cameraState.pitch, 0.78) - cameraState.pitch) * ease;
    }
    const { yaw, pitch, distance } = cameraState;
    goal.current.set(
      focus.current.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.current.y + Math.sin(pitch) * distance,
      focus.current.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    );
    const minY = getTerrainHeight(goal.current.x, goal.current.z) + 0.8;
    if (goal.current.y < minY) goal.current.y = minY;
    camera.position.lerp(goal.current, 1 - Math.exp(-delta * 8));
    camera.lookAt(focus.current);
  });

  return null;
}
