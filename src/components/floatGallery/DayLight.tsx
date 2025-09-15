'use client';

import React, { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';


export default function DayLight(): React.JSX.Element {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const { scene } = useThree();

  useEffect(() => {
    if (lightRef.current) {
      // 影の可視範囲を広くしてシャドウが出るようにする
lightRef.current.shadow.camera.left = -80;
lightRef.current.shadow.camera.right = 80;
lightRef.current.shadow.camera.top = 80;
lightRef.current.shadow.camera.bottom = -80;
lightRef.current.shadow.camera.near = 0.5;
lightRef.current.shadow.camera.far = 250;

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
      />
    </>
  );
}
