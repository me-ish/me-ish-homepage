import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import ArtworkFrameWhite from '../whiteGallery/ArtworkFrameWhite'
import ArtworkLabelWhite from '../whiteGallery/ArtworkLabelWhite'
import { useZoomArtwork } from '../shared/ZoomArtworkContext'
import { supabase } from '../../supabaseClient'

export default function ArtworksInGallery({ avatarRef }) {
  const { zoomedArtwork } = useZoomArtwork()
  const [artworks, setArtworks] = useState([])

  useEffect(() => {
    const fetchArtworks = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('confirmed', true)
        .eq('gallery_type', 'white')
        .order('created_at', { ascending: true })
        .limit(100);
  
      if (error) {
        console.error('エントリー取得エラー:', error);
        return;
      }
  
      const realEntries = data.map((item) => {
        const fileName = item.file_name;
        const finalUrl = supabase.storage
          .from('artworks')
          .getPublicUrl(`final/${fileName}`).data.publicUrl;
  
        return {
          title: item.title,
          author: item.artist_name,
          imageUrl: finalUrl, // ✅ 強制的にfinalのURLに
          description: item.description || '',
          is_for_sale: item.is_for_sale,
          price: item.price,
          sns_links: item.sns_links || '{}',
          id: item.id,
          created_at: item.created_at,
          ratio: item.aspect_ratio || 1,
          scale: 1.2,
        };
      });
  
      const dummyEntries = [...Array(7)].map((_, i) => ({
        title: 'Coming Soon',
        author: 'me-ish',
        imageUrl: `/images/comingsoon-${i + 1}.jpg`,
        description: '',
        is_for_sale: false,
        price: null,
        sns_links: '{}',
        id: null,
        created_at: null,
        ratio: 1,
        scale: 1.0,
      }));
  
      const combined = [...realEntries, ...dummyEntries].slice(0, 10);
  
      const prepared = combined.map((art, i, all) => {
        const angle = (i / all.length) * Math.PI * 2 + Math.PI / 10;
        const radius = 20;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 3;
  
        const position = new THREE.Vector3(x, y, z);
        const target = new THREE.Vector3(0, y, 0);
        const dummy = new THREE.Object3D();
        dummy.position.copy(position);
        dummy.lookAt(target);
        dummy.rotateY(Math.PI);
  
        return {
          key: `art-${i}`,
          position: position.toArray(),
          rotation: dummy.rotation.toArray(),
          ...art,
        };
      });
  
      setArtworks(prepared);
    };
  
    fetchArtworks();
  }, []);
  

  return (
    <>
      {!zoomedArtwork &&
        artworks.map((art) => (
          <React.Fragment key={art.key}>
            <ArtworkFrameWhite
              data={{
                ...art,
                position: art.position,
                rotation: art.rotation,
              }}
              avatarRef={avatarRef}
            />
            <ArtworkLabelWhite
              position={art.position}
              rotation={art.rotation}
              width={2.5 * art.scale}
              height={(2.5 * art.scale) / art.ratio}
              avatarRef={avatarRef}
              title={art.title}
              author={art.author}
            />
          </React.Fragment>
        ))}
    </>
  )
}
