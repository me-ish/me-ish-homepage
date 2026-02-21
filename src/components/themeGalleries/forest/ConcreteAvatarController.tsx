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
  // --- パーティション ---
  // U_L_Spine: R3F pos [-10, 3.25, -1.5], size [0.35, 6.5, 21]
  { minX: -10.175, maxX: -9.825, minZ: -12, maxZ: 9 },
  // U_L_Top: R3F pos [-16, 3.25, -12], size [12, 6.5, 0.35]
  { minX: -22, maxX: -10, minZ: -12.175, maxZ: -11.825 },
  // U_L_Bottom: R3F pos [-16, 3.25, 9], size [12, 6.5, 0.35]
  { minX: -22, maxX: -10, minZ: 8.825, maxZ: 9.175 },
  // U_R_Spine: R3F pos [10, 3.25, -1.5], size [0.35, 6.5, 21]
  { minX: 9.825, maxX: 10.175, minZ: -12, maxZ: 9 },
  // U_R_Top: R3F pos [16, 3.25, -12], size [12, 6.5, 0.35]
  { minX: 10, maxX: 22, minZ: -12.175, maxZ: -11.825 },
  // U_R_Bottom: R3F pos [16, 3.25, 9], size [12, 6.5, 0.35]
  { minX: 10, maxX: 22, minZ: 8.825, maxZ: 9.175 },

  // --- 中庭ガラス壁 ---
  // Glass_N: R3F pos [0, 4, -7], size [8, 8, 0.05]
  { minX: -4, maxX: 4, minZ: -7.025, maxZ: -6.975 },
  // Glass_S: R3F pos [0, 4, 1], size [8, 8, 0.05]
  { minX: -4, maxX: 4, minZ: 0.975, maxZ: 1.025 },
  // Glass_E: R3F pos [4, 4, -3], size [0.05, 8, 8]
  { minX: 3.975, maxX: 4.025, minZ: -7, maxZ: 1 },
  // Glass_W: R3F pos [-4, 4, -3], size [0.05, 8, 8]
  { minX: -4.025, maxX: -3.975, minZ: -7, maxZ: 1 },

  // --- ベンチ ---
  // Bench_0: R3F pos [0, 0.22, 4], size [1.5, 0.22, 0.3]
  { minX: -0.75, maxX: 0.75, minZ: 3.85, maxZ: 4.15 },
  // Bench_1: R3F pos [0, 0.22, -2], size [1.5, 0.22, 0.3]
  { minX: -0.75, maxX: 0.75, minZ: -2.15, maxZ: -1.85 },
  // Bench_2: R3F pos [-18, 0.25, 0], size [3, 0.5, 0.5]
  { minX: -19.5, maxX: -16.5, minZ: -0.25, maxZ: 0.25 },
  // Bench_3: R3F pos [18, 0.25, 0], size [3, 0.5, 0.5]
  { minX: 16.5, maxX: 19.5, minZ: -0.25, maxZ: 0.25 },
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
