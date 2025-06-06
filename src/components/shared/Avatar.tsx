'use client';

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { Trail, useTexture } from '@react-three/drei';
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

  // ✅ useTexture に変更（型エラー回避）
  const tilesMap = useTexture('/textures/Tiles044_BaseColor.jpg');

  // ✅ スプリングの定義（位置・拡大・発光）
  const { scale, opacity, position, emissiveIntensity } = useSpring({
    scale: [0.1, 0.1, 0.1],
    opacity: 1,
    emissiveIntensity: 1,
    position: [0, 2.5, 0],
    config: { tension: 0, friction: 0 },
  });

  // ✅ ゆらぎ & 移動制限
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

  // ✅ ref に current を expose
useImperativeHandle(ref, () => {
  const refObj = (combinedRef as MutableRefObject<THREE.Group | null>).current;
  if (!refObj) {
    throw new Error('Avatar groupRef is null — useImperativeHandle failed.');
  }
  return refObj;
});


  return (
    <Trail
      width={1.2}
      color={'lightyellow'}
      length={4}
      attenuation={(t) => t ** 2.2}
    >
      <a.group
        ref={combinedRef}
        // ✅ to((x,y,z) => [...]) で型を明示的に補完
        position={position.to((x, y, z) => [x, y, z] as [number, number, number])}
        scale={scale.to((x, y, z) => [x, y, z] as [number, number, number])}
        {...props}
      >
        {/* 内核：発光球 */}
<mesh>
  <sphereGeometry args={[0.5, 64, 64]} />
  <a.meshStandardMaterial
    map={tilesMap}
    color="#ffffff"
    emissive="#00ffff"
    emissiveIntensity={emissiveIntensity as unknown as number}
    toneMapped={false}
    transparent
    attach="material"
  />
</mesh>

        {/* 外殻：グロー */}
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

