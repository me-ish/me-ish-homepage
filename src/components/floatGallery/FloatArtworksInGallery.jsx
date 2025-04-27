import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import ArtworkFrame from '../shared/ArtworkFrame';
import { supabase } from '../../supabaseClient';

export default function FloatArtworksInGallery({ avatarRef, artworkRefs }) {
  const wallY = 3.5;
  const wallZ = 39;
  const wallX = 39;
  const offset = 10;
  const centerGap = 30;
  const start = -30;

  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const fetchApproved = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('is_approved', true)
        .eq('gallery_type', 'float')
        .order('created_at', { ascending: false });

      if (!error) setEntries(data);
    };

    fetchApproved();
  }, []);

  // 座標生成関数
  const generatePositions = (start) => {
    const left = Array(3).fill().map((_, i) => start + i * offset);
    const right = Array(3).fill().map((_, i) => start + offset + centerGap + i * offset);
    return [...left, ...right];
  };

  const makeArtwork = (x, y, z, rotationY) => {
    const distanceFromWall = -0.4;
    const dir = new THREE.Vector3(0, 0, 1);
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    dir.multiplyScalar(distanceFromWall);
    return {
      position: [x + dir.x, y + dir.y, z + dir.z],
      rotation: [0, rotationY, 0],
    };
  };

  // 全24枚分の位置リスト
  const positions = [
    ...generatePositions(start).map(x => makeArtwork(x, wallY, -wallZ, Math.PI)),
    ...generatePositions(start).map(x => makeArtwork(x, wallY, wallZ, 0)),
    ...generatePositions(start).map(z => makeArtwork(-wallX, wallY, z, -Math.PI / 2)),
    ...generatePositions(start).map(z => makeArtwork(wallX, wallY, z, Math.PI / 2)),
  ];

  return (
    <>
      {positions.map((pos, i) => {
        const entry = entries[i]; // 該当する承認済み作品があれば使う
        if (!entry) return null; // 枠数 > データ数 の場合は非表示

        return (
          <ArtworkFrame
            key={entry.id}
            position={pos.position}
            rotation={pos.rotation}
            ratio={1.2}
            scale={1.8}
            title={entry.title}
            author={entry.artist_name}
            imageUrl={entry.image_url}
            avatarRef={avatarRef}
            ref={(el) => (artworkRefs.current[i] = el)}
          />
        );
      })}
    </>
  );
}

