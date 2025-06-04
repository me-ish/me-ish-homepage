'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystick?: { x: number; y: number }; // ※未使用時は無視される
};

export default function AvatarController({ avatarRef, joystick }: AvatarControllerProps) {
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(() => {
    if (!avatarRef.current) return;

    const moveSpeed = 0.1;
    direction.current.set(0, 0, 0);

    const useJoystick = joystick && (joystick.x !== 0 || joystick.y !== 0);

    if (useJoystick) {
      direction.current.x = joystick.x;
      direction.current.z = -joystick.y;
    } else {
      if (keys.current['w']) direction.current.z -= 1;
      if (keys.current['s']) direction.current.z += 1;
      if (keys.current['a']) direction.current.x -= 1;
      if (keys.current['d']) direction.current.x += 1;
    }

    if (direction.current.length() > 0) {
      direction.current.normalize();

      const moveDir = new THREE.Vector3();
      camera.getWorldDirection(moveDir);
      moveDir.y = 0;
      moveDir.normalize();

      const sideDir = new THREE.Vector3().crossVectors(camera.up, moveDir).normalize();

      const finalMove = new THREE.Vector3();
      finalMove.addScaledVector(moveDir, -direction.current.z);
      finalMove.addScaledVector(sideDir, -direction.current.x);

      velocity.current.lerp(finalMove, 0.1); // 慣性移動
      avatarRef.current.position.add(velocity.current.clone().multiplyScalar(moveSpeed));
    } else {
      // 停止時の慣性ゼロ化（必要なら）
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
