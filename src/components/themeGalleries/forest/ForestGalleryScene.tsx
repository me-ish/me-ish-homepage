'use client';

import React, { Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';

import ConcreteEnvironment from './ForestEnvironment';
import ConcreteBuilding from './ForestGround';
import ConcreteLightSlits from './ForestParticles';
import ConcreteArtworks from './ForestExhibitPanels';
import ConcreteAvatarController from './ConcreteAvatarController';

import Avatar from '@/components/shared/Avatar';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import JoystickInput from '@/components/shared/JoystickInput';
import { useIsMobile } from '@/lib/useIsMobile';

/**
 * ConcreteGalleryScene - 安藤忠雄スタイルのコンクリートギャラリー
 *
 * 30m × 20m の建物に36点のアートワークを展示。
 * WASD / ジョイスティックで移動、マウスドラッグ / 矢印キーでカメラ回転。
 */

type Props = {
  className?: string;
};

function SceneContent({
  avatarRef,
  joystickRef,
}: {
  avatarRef: React.RefObject<THREE.Group>;
  joystickRef: React.RefObject<{ x: number; y: number }>;
}): React.JSX.Element {
  return (
    <>
      <ConcreteEnvironment />
      <ConcreteBuilding />
      <ConcreteLightSlits />
      <ConcreteArtworks />

      <Avatar ref={avatarRef} />
      <ConcreteAvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
      <ThirdPersonCamera avatarRef={avatarRef} />
    </>
  );
}

export default function ForestGalleryScene({ className }: Props): React.JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const joystickRef = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  // モバイルでのスクロール・タッチ挙動を制御
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  return (
    <div className={className} style={{ width: '100%', height: '100%' }} onContextMenu={(e) => e.preventDefault()}>
      {isMobile && (
        <JoystickInput
          onMove={({ x, y }) => {
            joystickRef.current = { x, y };
          }}
        />
      )}
      <Canvas
        camera={{
          position: [0, 5, 15],
          fov: 60,
          near: 0.1,
          far: 200,
        }}
        gl={{
          antialias: !isMobile,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        dpr={isMobile ? 1 : [1, 2]}
        tabIndex={0}
        onPointerDown={(e) => e.currentTarget.focus()}
      >
        <Suspense fallback={null}>
          <SceneContent avatarRef={avatarRef} joystickRef={joystickRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
