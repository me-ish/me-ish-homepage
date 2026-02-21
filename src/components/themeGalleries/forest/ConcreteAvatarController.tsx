'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * ConcreteAvatarController - コンクリートギャラリー用アバター移動制御
 *
 * WASD + モバイルジョイスティック入力でカメラ相対移動。
 * 外壁の内側に制限 + パーティション衝突判定（軸平行AABB）。
 */

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

const MOVE_SPEED = 0.1;
const LERP_FACTOR = 0.2;
const AVATAR_RADIUS = 0.5;
const PUSH_EPS = 0.001;

// 外壁の内面座標（壁厚0.3、半分で0.15）
// 建物: 30m x 20m → x: ±15, z: ±10 → 内面: x: ±14.7, z: ±9.7
const BOUNDARY = {
  minX: -14.7 + AVATAR_RADIUS,
  maxX: 14.7 - AVATAR_RADIUS,
  minZ: -9.7 + AVATAR_RADIUS,
  maxZ: 9.7 - AVATAR_RADIUS,
};

// パーティションのAABB（XZ平面、Three.js座標）
// position と size から min/max を算出済み
type BoxAABB = { minX: number; maxX: number; minZ: number; maxZ: number };

const PARTITIONS: BoxAABB[] = [
  // U_L_Spine: pos [-5, 2, -0.25], size [0.25, 4, 10.5]
  { minX: -5.125, maxX: -4.875, minZ: -5.5, maxZ: 5.0 },
  // U_L_Top: pos [-8, 2, -5.5], size [6, 4, 0.25]
  { minX: -11, maxX: -5, minZ: -5.625, maxZ: -5.375 },
  // U_L_Bottom: pos [-8, 2, 5], size [6, 4, 0.25]
  { minX: -11, maxX: -5, minZ: 4.875, maxZ: 5.125 },
  // U_R_Spine: pos [5, 2, -0.25], size [0.25, 4, 10.5]
  { minX: 4.875, maxX: 5.125, minZ: -5.5, maxZ: 5.0 },
  // U_R_Top: pos [8, 2, -5.5], size [6, 4, 0.25]
  { minX: 5, maxX: 11, minZ: -5.625, maxZ: -5.375 },
  // U_R_Bottom: pos [8, 2, 5], size [6, 4, 0.25]
  { minX: 5, maxX: 11, minZ: 4.875, maxZ: 5.125 },
];

/**
 * 円（アバター）と軸平行矩形（パーティション）の衝突解決
 * パーティションをアバター半径分膨張させ、点-矩形判定に帰着
 */
function resolvePartitionCollision(px: number, pz: number): { x: number; z: number } {
  let x = px;
  let z = pz;

  for (const box of PARTITIONS) {
    // 膨張AABB（アバター半径分）
    const eMinX = box.minX - AVATAR_RADIUS;
    const eMaxX = box.maxX + AVATAR_RADIUS;
    const eMinZ = box.minZ - AVATAR_RADIUS;
    const eMaxZ = box.maxZ + AVATAR_RADIUS;

    // 膨張AABBの内側にいるか
    if (x > eMinX && x < eMaxX && z > eMinZ && z < eMaxZ) {
      // 4辺への押し出し距離を計算
      const pushLeft = x - eMinX;
      const pushRight = eMaxX - x;
      const pushFront = z - eMinZ;
      const pushBack = eMaxZ - z;

      // 最小押し出し方向へ解決
      const minPush = Math.min(pushLeft, pushRight, pushFront, pushBack);

      if (minPush === pushLeft) {
        x = eMinX - PUSH_EPS;
      } else if (minPush === pushRight) {
        x = eMaxX + PUSH_EPS;
      } else if (minPush === pushFront) {
        z = eMinZ - PUSH_EPS;
      } else {
        z = eMaxZ + PUSH_EPS;
      }
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

    // キーボード入力が優先
    if (keys.current['w'] || keys.current['a'] || keys.current['s'] || keys.current['d']) {
      inputX = 0;
      inputY = 0;
      if (keys.current['w']) inputY -= 1;
      if (keys.current['s']) inputY += 1;
      if (keys.current['a']) inputX -= 1;
      if (keys.current['d']) inputX += 1;
    }

    if (inputX !== 0 || inputY !== 0) {
      // カメラ相対移動
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

      // パーティション衝突解決
      const resolved = resolvePartitionCollision(avatar.position.x, avatar.position.z);
      avatar.position.x = resolved.x;
      avatar.position.z = resolved.z;

      // 外壁境界クランプ
      avatar.position.x = THREE.MathUtils.clamp(avatar.position.x, BOUNDARY.minX, BOUNDARY.maxX);
      avatar.position.z = THREE.MathUtils.clamp(avatar.position.z, BOUNDARY.minZ, BOUNDARY.maxZ);
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
