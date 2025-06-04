'use client';

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader, AdditiveBlending } from 'three';
import { Trail } from '@react-three/drei';
import { a, useSpring } from '@react-spring/three';
import * as THREE from 'three';

// group要素に渡せるすべてのpropsを保持する型
type AvatarProps = JSX.IntrinsicElements['group'];

const Avatar = forwardRef(function AvatarComponent(
  props: AvatarProps,
  ref: React.ForwardedRef<THREE.Group>
) {
  const internalRef = useRef<THREE.Group>(null);
  const combinedRef = ref ?? internalRef;

  const tilesMap = useLoader(TextureLoader, '/textures/Tiles044_BaseColor.jpg');

  const { scale, opacity, position, emissiveIntensity } = useSpring({
    scale: [0.1, 0.1, 0.1],
    opacity: 1,
    emissiveIntensity: 1,
    position: [0, 2.5, 0],
    config: { tension: 0, friction: 0 },
  });

  useFrame((state) => {
    const refObj = (combinedRef as MutableRefObject<THREE.Group | null>).current;
    if (refObj) {
      refObj.position.y += Math.sin(state.clock.elapsedTime * 2) * 0.002;

      const pos = refObj.position;
      const limit = 38.5;
      pos.x = Math.max(Math.min(pos.x, limit), -limit);
      pos.z = Math.max(Math.min(pos.z, limit), -limit);
    }
  });

  useImperativeHandle(ref, () => {
    return (combinedRef as MutableRefObject<THREE.Group | null>).current;
  });

  return (
    <Trail
      width={1.2}
      color={'lightyellow'}
      length={4}
      attenuation={(t) => t ** 2.2}
    >
      <a.group ref={combinedRef} position={position} scale={scale} {...props}>
        {/* 内核（テクスチャ＋発光） */}
        <mesh>
          <sphereGeometry args={[0.5, 64, 64]} />
          <a.meshStandardMaterial
            map={tilesMap}
            color="#ffffff"
            emissive="#00ffff"
            emissiveIntensity={emissiveIntensity}
            toneMapped={false}
            transparent
            opacity={opacity}
          />
        </mesh>

        {/* 外殻（光のグロー） */}
        <mesh>
          <sphereGeometry args={[0.7, 64, 64]} />
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
      </a.group>
    </Trail>
  );
}) as React.ForwardRefExoticComponent<
  AvatarProps & React.RefAttributes<THREE.Group>
>;

export default Avatar;
