'use client';

import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { a, useSpring } from '@react-spring/three';
import { useTexture } from '@react-three/drei';
import { useZoomArtwork } from './ZoomArtworkContext';

type ArtworkFrameProps = {
  id: string;
  aspectRatio?: number;
  scale?: number;
  title?: string;
  author?: string;
  imageUrl?: string;
  avatarRef: React.RefObject<THREE.Group>;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
} & Omit<ThreeElements['group'], 'id'>;

type ArtworkFrameHandle = THREE.Group & {
  title: string;
  author: string;
};

const ArtworkFrame = forwardRef<ArtworkFrameHandle, ArtworkFrameProps>(
  (
    {
      id,
      position = [0, 2, 0],
      rotation = [0, 0, 0],
      aspectRatio = 1,
      scale = 1,
      title = 'Untitled',
      author = 'Unknown',
      imageUrl = '',
      avatarRef,
      ...rest
    },
    ref
  ) => {
    const { setZoomedArtwork } = useZoomArtwork();
    const groupRef = useRef<THREE.Group>(null);

    useImperativeHandle(ref, () => {
      if (!groupRef.current) {
        throw new Error('groupRef is not available');
      }
      const group = groupRef.current as ArtworkFrameHandle;
      group.title = title;
      group.author = author;
      return group;
    }, [title, author]);

    const width = 2.5 * scale;
    const height = width / aspectRatio;
    const adjustedRotation: [number, number, number] = [
      rotation[0],
      rotation[1] + Math.PI,
      rotation[2],
    ];

    // フォールバック画像対応（public/textures/fallback.jpg を用意推奨）
    const texture = useTexture(imageUrl || '/textures/fallback.jpg');

    const [springs, api] = useSpring(() => ({
      emissiveIntensity: 0,
      config: { mass: 1, tension: 200, friction: 30 },
    }));

    const [shouldGlow, setShouldGlow] = useState(false);

    useFrame(() => {
      if (!avatarRef?.current) return;

      const artworkPos = new THREE.Vector3(...position);
      const avatarPos = avatarRef.current.position;
      const distance = artworkPos.distanceTo(avatarPos);

      api.start({
        emissiveIntensity: distance < 7 ? 1.5 : 0,
      });

      if (distance < 7 && !shouldGlow) {
        setShouldGlow(true);
        setTimeout(() => setShouldGlow(false), 1200);
      }
    });

    return (
      <group
        ref={groupRef}
        position={position}
        rotation={adjustedRotation}
        onClick={(e) => {
          e.stopPropagation();
          setZoomedArtwork({ id, imageUrl, title, author, width, height });
        }}
        {...rest}
      >
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>

        <a.mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[width + 0.1, height + 0.1]} />
<a.meshStandardMaterial
  color="#000000"
  emissive="#ffeeaa"
  // @ts-ignore
  emissiveIntensity={springs.emissiveIntensity}
  side={THREE.DoubleSide}
/>
        </a.mesh>
      </group>
    );
  }
);

ArtworkFrame.displayName = 'ArtworkFrame';
export default ArtworkFrame;
