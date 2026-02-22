'use client';

import React, { Suspense, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';

import TestEnvironment from './TestEnvironment';
import TestBuilding from './TestBuilding';
import TestLightSlits from './TestLightSlits';

import Avatar from '@/components/shared/Avatar';
import TestAvatarController from './TestAvatarController';
import ThirdPersonCamera from '@/components/shared/ThirdPersonCamera';
import JoystickInput from '@/components/shared/JoystickInput';
import { useIsMobile } from '@/lib/useIsMobile';

/**
 * TestGalleryScene — テスト用ギャラリー
 *
 * 建物・環境・アバターのみのクリーンな状態。
 * 作品配置・機能テスト用途。
 */

type Props = {
  className?: string;
};

export default function TestGalleryScene({ className }: Props): React.JSX.Element {
  const avatarRef = useRef<THREE.Group>(null);
  const joystickRef = useRef({ x: 0, y: 0 });
  const isMobile = useIsMobile();

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
        camera={{ position: [0, 5, 20], fov: 60, near: 0.1, far: 300 }}
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
          <TestEnvironment />
          <TestBuilding />
          <TestLightSlits />
        </Suspense>

        <Avatar ref={avatarRef} position={[0, 2.5, 5]} />
        <TestAvatarController avatarRef={avatarRef} joystickRef={joystickRef} />
        <ThirdPersonCamera avatarRef={avatarRef} />
      </Canvas>
    </div>
  );
}
