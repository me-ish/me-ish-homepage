'use client';

import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import ArtworkFrame from '../shared/ArtworkFrame';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  avatarRef: React.RefObject<THREE.Group>;
  artworkRefs: React.MutableRefObject<(THREE.Group | null)[]>;
};

type Entry = {
  id: number;
  title: string;
  artist_name: string;
  image_url: string;
};

export default function FloatArtworksInGallery({
  avatarRef,
  artworkRefs,
}: Props): React.JSX.Element {
  const wallY = 3.5;
  const wallZ = 39;
  const wallX = 39;
  const offset = 10;
  const centerGap = 30;
  const start = -30;

  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    const fetchApproved = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('confirmed', true)
        .eq('gallery_type', 'float')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setEntries(data as Entry[]);
      }
    };

    fetchApproved();
  }, []);

  const generatePositions = (start: number): number[] => {
    const left = Array.from({ length: 3 }, (_, i) => start + i * offset);
    const right = Array.from({ length: 3 }, (_, i) => start + offset + centerGap + i * offset);
    return [...left, ...right];
  };

  const makeArtwork = (
    x: number,
    y: number,
    z: number,
    rotationY: number
  ): { position: [number, number, number]; rotation: [number, number, number] } => {
    const distanceFromWall = -0.4;
    const dir = new THREE.Vector3(0, 0, 1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    dir.multiplyScalar(distanceFromWall);
    return {
      position: [x + dir.x, y + dir.y, z + dir.z],
      rotation: [0, rotationY, 0],
    };
  };

  const positions = [
    ...generatePositions(start).map((x) => makeArtwork(x, wallY, -wallZ, Math.PI)),
    ...generatePositions(start).map((x) => makeArtwork(x, wallY, wallZ, 0)),
    ...generatePositions(start).map((z) => makeArtwork(-wallX, wallY, z, -Math.PI / 2)),
    ...generatePositions(start).map((z) => makeArtwork(wallX, wallY, z, Math.PI / 2)),
  ];

  return (
    <>
      {positions.map((pos, i) => {
        const entry = entries[i];
        if (!entry) return null;

        return (
          <ArtworkFrame
            key={entry.id}
            id={entry.id.toString()}
            position={pos.position}
            rotation={pos.rotation}
            aspectRatio={1.2}
            scale={1.8}
            title={entry.title}
            author={entry.artist_name}
            imageUrl={entry.image_url}
            avatarRef={avatarRef}
            ref={(el: THREE.Group | null) => {
              artworkRefs.current[i] = el;
            }}
          />
        );
      })}
    </>
  );
}