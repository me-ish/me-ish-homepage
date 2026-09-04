'use client';

import { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { FLOAT_PANELS } from '@/components/floatGallery/floatPanels.constants';

type AvatarControllerProps = {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
};

// 定数
const MOVE_SPEED = 0.1;
const LERP_FACTOR = 0.2;

// ギャラリー境界（壁の内側に制限）
const GALLERY_BOUNDARY = 38;

// アバター半径（XZ）
const AVATAR_RADIUS = 0.85;

// 押し出しの微小パディング（めり込み/再衝突のループを減らす）
const PUSH_EPS = 0.001;

type PanelCollisionPrecalc = {
  rad: number;
  cx: number;
  cz: number;
  // 幅方向（tangent）= panel local X axis in world
  tx: number;
  tz: number;
  // 厚み方向（normal）= panel local Z axis in world
  nx: number;
  nz: number;
};

function buildPanelPrecalc(): PanelCollisionPrecalc[] {
  return FLOAT_PANELS.anglesDeg.map((deg) => {
    const rad = (deg * Math.PI) / 180;

    // パネル中心（ワールド）
    const cx = Math.cos(rad) * FLOAT_PANELS.radius;
    const cz = Math.sin(rad) * FLOAT_PANELS.radius;

    /**
     * FloatPanels.tsx 側は rotation: [0, rad, 0]
     * three.jsのY回転（右手系）で
     * - local X (幅方向) -> (cos(rad), 0, -sin(rad))
     * - local Z (厚み方向) -> (sin(rad), 0,  cos(rad))
     *
     * ここを間違えると「延長線上の無限帯」判定が出る。
     */
    const tx = Math.cos(rad);
    const tz = -Math.sin(rad);

    const nx = Math.sin(rad);
    const nz = Math.cos(rad);

    return { rad, cx, cz, tx, tz, nx, nz };
  });
}

/**
 * パネル（回転矩形）とアバター（円）衝突解決
 * - dot積でローカル成分（幅方向/厚み方向）を求める
 * - 侵入量が小さい軸へ押し出し（角で詰まりにくい）
 */
function checkPanelCollision(
  pos: THREE.Vector3,
  precalc: PanelCollisionPrecalc[],
  halfW: number,
  halfT: number
): THREE.Vector3 {
  const result = pos.clone();

  for (const p of precalc) {
    // パネル中心からの相対ベクトル（ワールド）
    const dx = result.x - p.cx;
    const dz = result.z - p.cz;

    // ローカル距離（tangent=幅方向, normal=厚み方向）
    const localX = dx * p.tx + dz * p.tz; // dot(d, t)
    const localZ = dx * p.nx + dz * p.nz; // dot(d, n)

    const ax = Math.abs(localX);
    const az = Math.abs(localZ);

    // 回転矩形（膨張済み）の内側に入っているか
    if (ax < halfW && az < halfT) {
      const penX = halfW - ax;
      const penZ = halfT - az;

      // 最小押し出し（MTV）
      if (penX < penZ) {
        const s = localX >= 0 ? 1 : -1;
        const d = penX + PUSH_EPS;
        result.x += p.tx * (s * d);
        result.z += p.tz * (s * d);
      } else {
        const s = localZ >= 0 ? 1 : -1;
        const d = penZ + PUSH_EPS;
        result.x += p.nx * (s * d);
        result.z += p.nz * (s * d);
      }
    }
  }

  return result;
}

export default function FloatAvatarController({ avatarRef, joystickRef }: AvatarControllerProps) {
  const velocity = useRef(new THREE.Vector3());
  const keys = useRef<Record<string, boolean>>({});
  const { camera } = useThree();

  // 再利用用ベクトル（GC回避）
  const moveVector = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const tempVelocity = useRef(new THREE.Vector3());

  // パネル判定用の事前計算（固定）
  const panelPrecalc = useMemo(() => buildPanelPrecalc(), []);

  // パネル半サイズ（アバター半径分を加味して膨張）
  const halfW = useMemo(
    () => FLOAT_PANELS.width / 2 + AVATAR_RADIUS + FLOAT_PANELS.collisionMargin,
    []
  );
  const halfT = useMemo(
    () => FLOAT_PANELS.thickness / 2 + AVATAR_RADIUS + FLOAT_PANELS.collisionMargin,
    []
  );

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

      // 先に中央パネル衝突補正
      avatar.position.copy(checkPanelCollision(avatar.position, panelPrecalc, halfW, halfT));

      // 最後に境界クランプで安定化
      avatar.position.x = Math.max(-GALLERY_BOUNDARY, Math.min(GALLERY_BOUNDARY, avatar.position.x));
      avatar.position.z = Math.max(-GALLERY_BOUNDARY, Math.min(GALLERY_BOUNDARY, avatar.position.z));
    } else {
      velocity.current.set(0, 0, 0);
    }
  });

  return null;
}
