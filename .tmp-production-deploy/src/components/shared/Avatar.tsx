'use client';

import { forwardRef, useRef, useImperativeHandle } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { Trail, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const BASE_Y = 2.5;

type AvatarProps = ThreeElements['group'];

const Avatar = forwardRef<THREE.Group, AvatarProps>((props, ref) => {
  const groupRef = useRef<THREE.Group>(null);

  // 外部refを内部refに接続（forwardRefで親のrefに接続可能にする）
  useImperativeHandle(ref, () => groupRef.current!, []);

  const tilesMap = useTexture('/textures/Tiles044_BaseColor.jpg');

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    // ドリフトしないよう、ベース位置 + sin オフセットで絶対指定
    group.position.y = BASE_Y + Math.sin(state.clock.elapsedTime * 2) * 0.002;
  });

  return (
    <Trail
      width={1.2}
      color={'lightyellow'}
      length={4}
      attenuation={(t) => t ** 2.2}
    >
      <group
        ref={groupRef}
        position={[0, BASE_Y, 0]}
        scale={[0.1, 0.1, 0.1]}
        {...props}
      >
        {/* 内核：発光球（16x16セグメントで十分） */}
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial
            map={tilesMap}
            color="#ffffff"
            emissive="#00ffff"
            emissiveIntensity={1}
            toneMapped={false}
            transparent
            attach="material"
          />
        </mesh>

        {/* 外殻：グロー（16x16セグメントで十分） */}
        <mesh>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial
            map={tilesMap}
            color="#00ffff"
            transparent
            opacity={0.6}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    </Trail>
  );
});

Avatar.displayName = 'Avatar';

export default Avatar;



