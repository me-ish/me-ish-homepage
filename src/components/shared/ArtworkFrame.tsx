'use client';

import React, {
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  MutableRefObject,
} from 'react';
import { useFrame, useLoader, ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import { TextureLoader } from 'three';
import { a, useSpring } from '@react-spring/three';
import { useZoomArtwork } from './ZoomArtworkContext';

type ArtworkFrameProps = {
  aspectRatio?: number;
  scale?: number;
  title?: string;
  author?: string;
  imageUrl?: string;
  avatarRef: React.RefObject<THREE.Group>;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
} & ThreeElements['group'];

const ArtworkFrame = forwardRef(function ArtworkFrameComponent(
  {
    position = [0, 2, 0],
    rotation = [0, 0, 0],
    aspectRatio = 1,
    scale = 1,
    title = 'Untitled',
    author = 'Unknown',
    imageUrl = '',
    avatarRef,
    ...rest
  }: ArtworkFrameProps,
  ref: React.ForwardedRef<THREE.Group>
) {
  const { setZoomedArtwork } = useZoomArtwork();
  const groupRef = useRef<THREE.Group>(null);

  useImperativeHandle(ref, () => {
    if (!groupRef.current) return null;
    return {
      ...groupRef.current,
      title,
      author,
    } as THREE.Group & { title: string; author: string };
  });

  const width = 2.5 * scale;
  const height = width / aspectRatio;
  const adjustedRotation: [number, number, number] = [
    rotation[0],
    rotation[1] + Math.PI,
    rotation[2],
  ];

  const texture = useLoader(TextureLoader, imageUrl ?? '');

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
        setZoomedArtwork({ imageUrl, title, author, width, height });
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
          emissiveIntensity={springs.emissiveIntensity}
          side={THREE.DoubleSide}
        />
      </a.mesh>
    </group>
  );
}) as React.ForwardRefExoticComponent<
  ArtworkFrameProps & React.RefAttributes<THREE.Group>
>;

ArtworkFrame.displayName = 'ArtworkFrame';
export default ArtworkFrame;
