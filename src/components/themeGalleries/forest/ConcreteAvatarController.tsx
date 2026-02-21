'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * ConcreteAvatarController v2 — 60m×40m ギャラリー用
 *
 * WASD + ジョイスティック、カメラ相対移動。
 * 外壁境界 + パーティション6枚 + 中庭ガラス壁4面 + ベンチ4台の衝突判定。
 */

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

const MOVE_SPEED = 0.15;
const LERP_FACTOR = 0.2;
const AVATAR_RADIUS = 0.5;
const PUSH_EPS = 0.001;

// 外壁内面（壁厚0.4、半分0.2）
// Building: 60×40 → 内面 x: ±29.6, z: ±19.6
const BOUNDARY = {
  minX: -29.6 + AVATAR_RADIUS,
  maxX: 29.6 - AVATAR_RADIUS,
  minZ: -19.6 + AVATAR_RADIUS,
  maxZ: 19.6 - AVATAR_RADIUS,
};

// 衝突ボックス一覧（XZ平面 AABB）
type BoxAABB = { minX: number; maxX: number; minZ: number; maxZ: number };

const COLLISION_BOXES: BoxAABB[] = [
  // --- パーティション（Spineのみ） ---
  // L_Spine: R3F pos [-10, 3.25, -1.5], size [0.35, 6.5, 21]
  { minX: -10.175, maxX: -9.825, minZ: -12, maxZ: 9 },
  // R_Spine: R3F pos [10, 3.25, -1.5], size [0.35, 6.5, 21]
  { minX: 9.825, maxX: 10.175, minZ: -12, maxZ: 9 },

];

function resolveCollisions(px: number, pz: number): { x: number; z: number } {
  let x = px;
  let z = pz;

  for (const box of COLLISION_BOXES) {
    const eMinX = box.minX - AVATAR_RADIUS;
    const eMaxX = box.maxX + AVATAR_RADIUS;
    const eMinZ = box.minZ - AVATAR_RADIUS;
    const eMaxZ = box.maxZ + AVATAR_RADIUS;

    if (x > eMinX && x < eMaxX && z > eMinZ && z < eMaxZ) {
      const pushLeft = x - eMinX;
      const pushRight = eMaxX - x;
      const pushFront = z - eMinZ;
      const pushBack = eMaxZ - z;
      const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);

      if (minPush === pushLeft) x = eMinX - PUSH_EPS;
      else if (minPush === pushRight) x = eMaxX + PUSH_EPS;
      else if (minPush === pushFront) z = eMinZ - PUSH_EPS;
      else z = eMaxZ + PUSH_EPS;
    }
  }

  return { x, z };
}

export default function ConcreteAvatarController({ avatarRef, joystickRef }: Props) {
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();

  const moveVector = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const tempVelocity = useRef(new THREE.Vector3());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
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

      // 衝突解決
      const resolved = resolveCollisions(avatar.position.x, avatar.position.z);
      avatar.position.x = resolved.x;
      avatar.position.z = resolved.z;

      // 境界クランプ
      avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, BOUNDARY.minX, BOUNDARY.maxX);
      avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, BOUNDARY.minZ, BOUNDARY.maxZ);
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
