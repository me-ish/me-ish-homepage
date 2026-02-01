'use client';

import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import { useFrame, type ThreeElements } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { Trail, useTexture } from '@react-three/drei';
import { useSpring } from '@react-spring/three';
import * as THREE from 'three';

type AvatarProps = ThreeElements['group'];

const Avatar = forwardRef<THREE.Group, AvatarProps>((props, ref) => {
  const groupRef = useRef<THREE.Group>(null);
  const glowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  // 外部refを内部refに接続（forwardRefで親のrefに接続可能にする）
  useImperativeHandle(ref, () => groupRef.current!, []);

  const tilesMap = useTexture('/textures/Tiles044_BaseColor.jpg');

  const { scale, opacity, emissiveIntensity } = useSpring({
    scale: [0.1, 0.1, 0.1],
    opacity: 1,
    emissiveIntensity: 1,
    config: { tension: 0, friction: 0 },
  });

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(0, 2.5, 0);
    }
  }, []);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y += Math.sin(state.clock.elapsedTime * 2) * 0.002;
    const [sx, sy, sz] = scale.get();
    group.scale.set(sx, sy, sz);
    const mat = glowMatRef.current;
    if (mat) mat.emissiveIntensity = emissiveIntensity.get();
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
        {...props}
      >
        {/* 内核：発光球（16x16セグメントで十分） */}
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          {/* @ts-ignore: react-spring 互換対策 */}
          <meshStandardMaterial
            ref={glowMatRef}
            map={tilesMap}
            color="#ffffff"
            emissive="#00ffff"
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

export default Avatar;



