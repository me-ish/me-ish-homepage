'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
};

/* ArtworkFrame(scale=1.8, aspect=1.2) と同じ見た目サイズ */
const SCALE = 4;
const ASPECT = 1.2;
const LIGHT_HEIGHT = 2.2;

function ComingSoonPanel({
  position,
  rotation,
  width = SCALE * ASPECT,
  height = SCALE,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  width?: number;
  height?: number;
}) {
  const map = useTexture('/coming-soon.png'); // public/coming-soon.png
  useMemo(() => {
    map.anisotropy = 8;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.colorSpace = THREE.SRGBColorSpace;
  }, [map]);

  return (
    <group position={position} rotation={rotation}>
      {/* 内側（ギャラリー中心）を正面にするためにY軸で反転 */}
      <group rotation={[0, Math.PI, 0]}>
        {/* 下地（額っぽい縁取り） */}
        <mesh>
          <planeGeometry args={[width + 0.08, height + 0.08]} />
          <meshStandardMaterial
            color="#eef2f7"
            emissive="#111111"
            emissiveIntensity={0.06}
            roughness={0.9}
            metalness={0.0}
          />
        </mesh>

        {/* 画像面 */}
        <mesh position={[0, 0, 0.002]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={map} toneMapped={false} />
        </mesh>

        {/* ほんのりオーラ */}
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[width + 0.22, height + 0.22]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export default function FloatPanelArtworks({
  avatarRef,
  artworkRefs,
}: Props): JSX.Element {
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

    const xAxis = new THREE.Vector3(1, 0, 0).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      rotationY
    );
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

  // artworkRefs のオフセット：外壁が 0-23 を使用するため、パネルは 24 から開始
  const PANEL_REFS_OFFSET = 24;

  return (
    <>
      {artworks.map((art, i) => {
        const id = `slot-panel-${i}`;
        return (
          <group
            key={id}
            ref={(el) => {
              artworkRefs.current[PANEL_REFS_OFFSET + i] = el;
            }}
          >
            <ComingSoonPanel position={art.position} rotation={art.rotation} />
            {/* pointLight 削除: 共有 SpotLight に統合（FloatGallery.tsx） */}
          </group>
        );
      })}
    </>
  );
}
