'use client';

import React from 'react';
import * as THREE from 'three';
import ArtworkFrame from '../shared/ArtworkFrame';

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
};

export default function FloatPanelArtworks({ avatarRef, artworkRefs }: Props): JSX.Element {
  const panelRadius = 16;
  const panelY = 3.5;
  const artworkGap = 4.5;
  const distanceFromPanel = 0.4;

  const sides = [
    { deg: 45, rotationY: Math.PI / 4 + Math.PI, frontScale: -2 },
    { deg: 135, rotationY: (3 * Math.PI) / 4, frontScale: -2 },
    { deg: 225, rotationY: (5 * Math.PI) / 4 + Math.PI, frontScale: -2 },
    { deg: 315, rotationY: -Math.PI / 4, frontScale: -2 },
  ];

  const artworks = sides.flatMap(({ deg, rotationY, frontScale }) => {
    const rad = (deg * Math.PI) / 180;
    const center = new THREE.Vector3(
      Math.cos(rad) * panelRadius,
      panelY,
      Math.sin(rad) * panelRadius
    );

    const xAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    const front = new THREE.Vector3(0, 0, 1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
      .multiplyScalar(distanceFromPanel * frontScale);

    return [-1, 1].map((i) => {
      const pos = center.clone().addScaledVector(xAxis, i * artworkGap).add(front);
      return {
        position: pos.toArray() as [number, number, number],
        rotation: [0, rotationY, 0] as [number, number, number],
      };
    });
  });

  return (
    <>
      {artworks.map((art, i) => (
        <ArtworkFrame
          key={i}
          position={art.position}
          rotation={art.rotation}
          ratio={1.2}
          scale={1.8}
          title={`Title ${i + 1}`}
          author={`Artist ${i + 1}`}
          imageUrl="/images/sample.jpg"
          avatarRef={avatarRef}
          ref={(el) => {
            artworkRefs.current[i] = el;
          }}
        />
      ))}
    </>
  );
}
