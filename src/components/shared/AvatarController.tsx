'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystick?: { x: number; y: number }; // スティック入力
};

export default function AvatarController({ avatarRef, joystick }: AvatarControllerProps) {
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
    if (!avatarRef.current) return;

    const moveSpeed = 0.1;
    const moveVector = new THREE.Vector3();

    let inputX = 0;
    let inputY = 0;

    if (joystick && (joystick.x !== 0 || joystick.y !== 0)) {
      inputX = joystick.x;
      inputY = joystick.y;
    } else {
      if (keys.current['w']) inputY -= 1;
      if (keys.current['s']) inputY += 1;
      if (keys.current['a']) inputX -= 1;
      if (keys.current['d']) inputX += 1;
    }

    if (inputX !== 0 || inputY !== 0) {
      // カメラの前方ベクトル取得
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      // カメラの右方向ベクトル取得（forward に垂直なベクトル）
      const right = new THREE.Vector3();
      right.crossVectors(forward, camera.up).normalize();

      // 入力を forward/right に合成
      moveVector
        .addScaledVector(forward, -inputY) // Yは前後
        .addScaledVector(right, inputX);   // Xは左右

      moveVector.normalize();

      velocity.current.lerp(moveVector, 0.2); // 慣性
      avatarRef.current.position.add(velocity.current.clone().multiplyScalar(moveSpeed));
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
