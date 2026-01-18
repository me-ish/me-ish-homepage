// C:\me-ish-next\src\components\shared\AvatarController.tsx
'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { FLOAT_PANELS } from '@/components/floatGallery/floatPanels.constants';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

// ============================================================
// Movement tuning
// ============================================================

const MOVE_SPEED = 0.1;
const LERP_FACTOR = 0.2;

// ギャラリー境界（壁の内側に制限）
const GALLERY_BOUNDARY = 38;

// アバター半径（XZ）
const AVATAR_RADIUS = 0.85;

// ============================================================
// Central panel collision (constants-driven)
// ============================================================

type PanelCollisionPrecalc = {
  rad: number;
  cx: number;
  cz: number;
  // width direction (tangent)
  tx: number;
  tz: number;
  // thickness direction (normal)
  nx: number;
  nz: number;
};

const PANEL_PRECALC: PanelCollisionPrecalc[] = FLOAT_PANELS.anglesDeg.map((deg) => {
  const rad = (deg * Math.PI) / 180;

  // panel center
  const cx = Math.cos(rad) * FLOAT_PANELS.radius;
  const cz = Math.sin(rad) * FLOAT_PANELS.radius;

// ✅ local X（幅）軸： (cos, -sin)
const tx = Math.cos(rad);
const tz = -Math.sin(rad);

// ✅ local Z（厚み/法線）軸： (sin, cos)
const nx = Math.sin(rad);
const nz = Math.cos(rad);

  return { rad, cx, cz, tx, tz, nx, nz };
});

/**
 * パネル（回転矩形）× アバター（円）の衝突解決
 * - dot積でローカル成分を算出（符号ズレ事故を排除）
 * - 侵入量が小さい軸へ押し出し（角で詰まらない）
 */
function checkPanelCollision(pos: THREE.Vector3): THREE.Vector3 {
  const result = pos.clone();

  // inflate by avatar radius + margin
  const halfW =
    FLOAT_PANELS.width / 2 + AVATAR_RADIUS + FLOAT_PANELS.collisionMargin;
  const halfT =
    FLOAT_PANELS.thickness / 2 + AVATAR_RADIUS + FLOAT_PANELS.collisionMargin;

  for (const p of PANEL_PRECALC) {
    const dx = result.x - p.cx;
    const dz = result.z - p.cz;

    // local distances (dot products)
    const localX = dx * p.tx + dz * p.tz; // along width axis
    const localZ = dx * p.nx + dz * p.nz; // along thickness axis

    const ax = Math.abs(localX);
    const az = Math.abs(localZ);

    // inside inflated OBB
    if (ax < halfW && az < halfT) {
      const penX = halfW - ax;
      const penZ = halfT - az;

      if (penX < penZ) {
        // push along width axis (tangent)
        const s = localX >= 0 ? 1 : -1;
        result.x += p.tx * (s * penX);
        result.z += p.tz * (s * penX);
      } else {
        // push along thickness axis (normal)
        const s = localZ >= 0 ? 1 : -1;
        result.x += p.nx * (s * penZ);
        result.z += p.nz * (s * penZ);
      }
    }
  }

  return result;
}

// ============================================================
// Component
// ============================================================

export default function AvatarController({
  avatarRef,
  joystickRef,
}: AvatarControllerProps) {
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();

  // reuse vectors (avoid GC)
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

    // joystick (default)
    let inputX = joystick.x;
    let inputY = -joystick.y;

    // keyboard overrides
    if (
      keys.current['w'] ||
      keys.current['a'] ||
      keys.current['s'] ||
      keys.current['d']
    ) {
      inputX = 0;
      inputY = 0;
      if (keys.current['w']) inputY -= 1;
      if (keys.current['s']) inputY += 1;
      if (keys.current['a']) inputX -= 1;
      if (keys.current['d']) inputX += 1;
    }

    if (inputX !== 0 || inputY !== 0) {
      // camera-aligned movement
      camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();

      right.current.crossVectors(forward.current, camera.up).normalize();

      moveVector.current
        .set(0, 0, 0)
        .addScaledVector(forward.current, -inputY)
        .addScaledVector(right.current, inputX)
        .normalize();

      // inertia
      velocity.current.lerp(moveVector.current, LERP_FACTOR);

      tempVelocity.current.copy(velocity.current).multiplyScalar(MOVE_SPEED);
      avatar.position.add(tempVelocity.current);

      // central panels collision first
      const corrected = checkPanelCollision(avatar.position);
      avatar.position.copy(corrected);

      // clamp last for stability
      avatar.position.x = Math.max(
        -GALLERY_BOUNDARY,
        Math.min(GALLERY_BOUNDARY, avatar.position.x)
      );
      avatar.position.z = Math.max(
        -GALLERY_BOUNDARY,
        Math.min(GALLERY_BOUNDARY, avatar.position.z)
      );
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
