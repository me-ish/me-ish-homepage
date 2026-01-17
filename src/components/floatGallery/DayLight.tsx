'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

// シャドウマップ設定
const SHADOW_MAP_SIZE = 2048;
const SHADOW_CAMERA_BOUNDS = 80;
const SHADOW_NEAR = 0.5;
const SHADOW_FAR = 250;

export default function DayLight(): React.JSX.Element {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (lightRef.current) {
      // シャドウカメラの範囲設定
      const shadowCam = lightRef.current.shadow.camera;
      shadowCam.left = -SHADOW_CAMERA_BOUNDS;
      shadowCam.right = SHADOW_CAMERA_BOUNDS;
      shadowCam.top = SHADOW_CAMERA_BOUNDS;
      shadowCam.bottom = -SHADOW_CAMERA_BOUNDS;
      shadowCam.near = SHADOW_NEAR;
      shadowCam.far = SHADOW_FAR;
      shadowCam.updateProjectionMatrix();

      // シャドウマップ品質
      lightRef.current.shadow.mapSize.width = SHADOW_MAP_SIZE;
      lightRef.current.shadow.mapSize.height = SHADOW_MAP_SIZE;
    }
  }, []);

  return (
    <>
      <ambientLight intensity={0.25} color="#f0f8ff" />
      <directionalLight
        ref={lightRef}
        position={[10, 60, 10]}
        intensity={1.0}
        color="#fff5e5"
        castShadow
        shadow-bias={-0.0001}
      />
    </>
  );
}
