'use client'

import React, { useEffect, useState } from 'react'
import * as THREE from 'three'
import ArtworkFrameWhite from '../whiteGallery/ArtworkFrameWhite'
import ArtworkLabelWhite from '../whiteGallery/ArtworkLabelWhite'
import { useZoomArtwork } from '../shared/ZoomArtworkContext'
import { supabase } from '@/lib/supabaseClient'

interface ArtworkEntry {
  title: string
  author: string
  imageUrl: string
  description: string
  is_for_sale: boolean
  price: number | null
  sns_links: string
  id: number | null
  created_at: string | null
  ratio: number
  scale: number
  position: [number, number, number]
  rotation: [number, number, number]
  key: string
}

interface ArtworksInGalleryProps {
  avatarRef: React.RefObject<THREE.Object3D>
}

export default function ArtworksInGallery({ avatarRef }: ArtworksInGalleryProps) {
  const { zoomedArtwork } = useZoomArtwork()
  const [artworks, setArtworks] = useState<ArtworkEntry[]>([])

  useEffect(() => {
    const fetchArtworks = async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('*')
        .eq('confirmed', true)
        .eq('gallery_type', 'white')
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        console.error('エントリー取得エラー:', error)
        return
      }

      const realEntries = (data || []).map((item) => {
        const fileName = item.file_name
        const finalUrl = supabase.storage
          .from('artworks')
          .getPublicUrl(`final/${fileName}`).data.publicUrl

        return {
          title: item.title,
          author: item.artist_name,
          imageUrl: finalUrl,
          description: item.description || '',
          is_for_sale: item.is_for_sale,
          price: item.price,
          sns_links: item.sns_links || '{}',
          id: item.id,
          created_at: item.created_at,
          ratio: item.aspect_ratio || 1,
          scale: 1.2,
        }
      })

      const dummyEntries = Array.from({ length: 7 }, (_, i) => ({
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
      }))

      const combined = [...realEntries, ...dummyEntries].slice(0, 10)

      const prepared = combined.map((art, i, all) => {
        const angle = (i / all.length) * Math.PI * 2 + Math.PI / 10
        const radius = 20
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = 3

        const position = new THREE.Vector3(x, y, z)
        const target = new THREE.Vector3(0, y, 0)
        const dummy = new THREE.Object3D()
        dummy.position.copy(position)
        dummy.lookAt(target)
        dummy.rotateY(Math.PI)

        return {
          key: `art-${i}`,
          position: position.toArray() as [number, number, number],
          rotation: dummy.rotation.toArray() as [number, number, number],
          ...art,
        }
      })

      setArtworks(prepared)
    }

    fetchArtworks()
  }, [])

  return (
    <>
      {!zoomedArtwork &&
        artworks.map((art) => (
          <ArtworkFrameWhite
            key={art.key}
            data={art}
            avatarRef={avatarRef}
          >
            <ArtworkLabelWhite
              avatarRef={avatarRef}
              title={art.title}
              author={art.author}
            />
          </ArtworkFrameWhite>
        ))}
    </>
  )
}
