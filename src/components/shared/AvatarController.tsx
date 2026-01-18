// C:\me-ish-next\src\components\shared\AvatarController.tsx
'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

// 定数
const MOVE_SPEED = 0.1;
const LERP_FACTOR = 0.2;

// ギャラリー境界（壁の内側に制限）
const GALLERY_BOUNDARY = 38; // 必要なら各ギャラリーで別Controllerに分ける

export default function AvatarController({ avatarRef, joystickRef }: AvatarControllerProps) {
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();

  // 再利用用ベクトル（GC回避）
  const moveVector = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const tempVelocity = useRef(new THREE.Vector3());

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

    let inputX = joystick.x;
    let inputY = -joystick.y;

    // キーが優先
    if (keys.current['w'] || keys.current['a'] || keys.current['s'] || keys.current['d']) {
      inputX = 0;
      inputY = 0;
      if (keys.current['w']) inputY -= 1;
      if (keys.current['s']) inputY += 1;
      if (keys.current['a']) inputX -= 1;
      if (keys.current['d']) inputX += 1;
    }

    if (inputX !== 0 || inputY !== 0) {
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();

      right.current.crossVectors(forward.current, camera.up).normalize();

      moveVector.current
        .set(0, 0, 0)
        .addScaledVector(forward.current, -inputY)
        .addScaledVector(right.current, inputX)
        .normalize();

      velocity.current.lerp(moveVector.current, LERP_FACTOR);

      tempVelocity.current.copy(velocity.current).multiplyScalar(MOVE_SPEED);
      avatar.position.add(tempVelocity.current);

      // 境界クランプ（White/共通の最低限）
      avatar.position.x = Math.max(-GALLERY_BOUNDARY, Math.min(GALLERY_BOUNDARY, avatar.position.x));
      avatar.position.z = Math.max(-GALLERY_BOUNDARY, Math.min(GALLERY_BOUNDARY, avatar.position.z));
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
