'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * DayLight - 美術館の環境光
 *
 * 室内美術館のため、自然光は控えめ。
 * スポットライト（GalleryLighting）がメインの照明となる。
 *
 * 構成:
 * - ambientLight: 全体の基調光（暗めに設定）
 * - hemisphereLight: 天井（暗）↔床（やや明）のグラデーション
 * - directionalLight: 開口部からの間接光を模擬（控えめ）
 */

// シャドウマップ設定
const SHADOW_MAP_SIZE = 1024;
const SHADOW_CAMERA_BOUNDS = 50;
const SHADOW_NEAR = 1;
const SHADOW_FAR = 100;

export default function DayLight(): React.JSX.Element {
  const lightRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    if (lightRef.current) {
      const shadowCam = lightRef.current.shadow.camera;
      shadowCam.left = -SHADOW_CAMERA_BOUNDS;
      shadowCam.right = SHADOW_CAMERA_BOUNDS;
      shadowCam.top = SHADOW_CAMERA_BOUNDS;
      shadowCam.bottom = -SHADOW_CAMERA_BOUNDS;
      shadowCam.near = SHADOW_NEAR;
      shadowCam.far = SHADOW_FAR;
      shadowCam.updateProjectionMatrix();

      lightRef.current.shadow.mapSize.width = SHADOW_MAP_SIZE;
      lightRef.current.shadow.mapSize.height = SHADOW_MAP_SIZE;
    }
  }, []);

  return (
    <>
      {/* 基調アンビエント - 美術館らしい明るさ */}
      <ambientLight intensity={0.45} color="#f0f0f5" />

      {/* ヘミスフィアライト - 天井と床の色差で空間感 */}
      <hemisphereLight
        color="#ffffff"       // 天井側（明るい）
        groundColor="#3a3a3a" // 床側（やや暗い）
        intensity={0.5}
      />

      {/* 全体を照らすフィルライト */}
      <directionalLight
        ref={lightRef}
        position={[15, 30, 15]}
        intensity={0.6}
        color="#fff8f5"
        castShadow
        shadow-bias={-0.0002}
      />
    </>
  );
}
