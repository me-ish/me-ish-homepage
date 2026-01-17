'use client';

import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

type ThirdPersonCameraProps = {
  avatarRef: React.RefObject<THREE.Group>;
};

// 定数
const CAMERA_RADIUS = 5;
const ROTATION_SPEED = 0.03;
const MOUSE_SENSITIVITY = 0.005;
const LERP_FACTOR = 0.1;
const PITCH_MIN = -1.2;
const PITCH_MAX = 0.8;
const JOYSTICK_EXCLUSION_RADIUS = 120;

export default function ThirdPersonCamera({ avatarRef }: ThirdPersonCameraProps) {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3());
  const avatarPos = useRef(new THREE.Vector3()); // 再利用用（GC回避）
  const rotation = useRef({ x: -0.2, y: 0 });
  const keysPressed = useRef<Record<string, boolean>>({});
  const isMouseDown = useRef(false);

  // マウス操作
  useEffect(() => {
    const dom = document.body;

    const onPointerDown = () => (isMouseDown.current = true);
    const onPointerUp = () => (isMouseDown.current = false);

    const onPointerMove = (e: PointerEvent) => {
      if (!isMouseDown.current) return;

      // 左下のスティック範囲を除外
      const dx = e.clientX - JOYSTICK_EXCLUSION_RADIUS;
      const dy = e.clientY - (window.innerHeight - JOYSTICK_EXCLUSION_RADIUS);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < JOYSTICK_EXCLUSION_RADIUS) return;

      rotation.current.y += e.movementX * MOUSE_SENSITIVITY;
      rotation.current.x -= e.movementY * MOUSE_SENSITIVITY;
      rotation.current.x = THREE.MathUtils.clamp(rotation.current.x, PITCH_MIN, PITCH_MAX);
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointermove', onPointerMove);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

  // キーボード操作（PC用）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame(() => {
    if (!avatarRef.current) return;

    // キーボードでの回転操作（PC向け）
    if (keysPressed.current['ArrowLeft']) rotation.current.y += ROTATION_SPEED;
    if (keysPressed.current['ArrowRight']) rotation.current.y -= ROTATION_SPEED;
    if (keysPressed.current['ArrowUp']) rotation.current.x -= ROTATION_SPEED;
    if (keysPressed.current['ArrowDown']) rotation.current.x += ROTATION_SPEED;
    rotation.current.x = THREE.MathUtils.clamp(rotation.current.x, PITCH_MIN, PITCH_MAX);

    // 再利用ベクトルに位置を取得（GC回避）
    avatarRef.current.getWorldPosition(avatarPos.current);

    const offsetY = 1.5 + rotation.current.x * 3;
    const camX = Math.sin(rotation.current.y) * CAMERA_RADIUS;
    const camZ = Math.cos(rotation.current.y) * CAMERA_RADIUS;

    targetPosition.current.set(
      avatarPos.current.x + camX,
      avatarPos.current.y + offsetY,
      avatarPos.current.z + camZ
    );

    camera.position.lerp(targetPosition.current, LERP_FACTOR);
    camera.lookAt(avatarPos.current);
  });

  return null;
}
