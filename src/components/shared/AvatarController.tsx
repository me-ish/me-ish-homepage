'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

export default function AvatarController({ avatarRef, joystickRef }: AvatarControllerProps) {
  const velocity = useRef(new THREE.Vector3());
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
    const avatar = avatarRef.current;
    const joystick = joystickRef.current;
    if (!avatar || !joystick) return;

    const moveSpeed = 0.1;
    const moveVector = new THREE.Vector3();

    let inputX = joystick.x;
    let inputY = -joystick.y;

    // キーが優先
    if (
      keys.current['w'] || keys.current['a'] ||
      keys.current['s'] || keys.current['d']
    ) {
      inputX = 0;
      inputY = 0;
      if (keys.current['w']) inputY -= 1;
      if (keys.current['s']) inputY += 1;
      if (keys.current['a']) inputX -= 1;
      if (keys.current['d']) inputX += 1;
    }

    console.log('🎮 inputX:', inputX, 'inputY:', inputY);

    if (inputX !== 0 || inputY !== 0) {
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      moveVector
        .addScaledVector(forward, -inputY)
        .addScaledVector(right, inputX)
        .normalize();

      velocity.current.lerp(moveVector, 0.2);
      avatar.position.add(velocity.current.clone().multiplyScalar(moveSpeed));

      console.log('🚶‍♂️ Moved to:', avatar.position.toArray());
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
