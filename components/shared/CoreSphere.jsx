import { useLoader, useFrame } from '@react-three/fiber'
import { TextureLoader, AdditiveBlending } from 'three'
import * as THREE from 'three'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { a, useSpring } from '@react-spring/three'
import { a as aWeb } from '@react-spring/web'
import { Html } from '@react-three/drei'

export const CoreSphere = ({ avatarRef }) => {
  const plasticMap = useLoader(TextureLoader, '/textures/Plastic008_BaseColor.jpg')
  const tilesMap = useLoader(TextureLoader, '/textures/Tiles044_BaseColor.jpg')
  const outerRef = useRef()
  const navigate = useNavigate()

  const [selected, setSelected] = useState(null)
  const [showUI, setShowUI] = useState(false)

  const { opacity, emissiveIntensity, uiOpacity } = useSpring({
    opacity: selected ? 0 : 0.7,
    emissiveIntensity: selected ? 2.5 : 0.4,
    uiOpacity: showUI ? 1 : 0,
    config: { tension: 80, friction: 26 },
    onRest: () => {
      if (selected) {
        setTimeout(() => {
          if (selected === 'white') navigate('/white')
          if (selected === 'float') navigate('/float')
        }, 300)
      }
    },
  })

  // 毎フレーム：回転と距離検出
  useFrame(() => {
    if (outerRef.current) {
      outerRef.current.rotation.y += 0.005
    }

    if (avatarRef?.current) {
      const avatarPos = avatarRef.current.position
      const dist = avatarPos.distanceTo(new THREE.Vector3(0, 5, 0))
      setShowUI(dist < 6) // ← 近づくとUI表示
    }
  })

  // スタイリッシュボタン共通スタイル
  const buttonStyle = {
    background: 'linear-gradient(135deg, #00ffff 0%, #007fff 100%)',
    border: 'none',
    color: 'white',
    fontWeight: 'bold',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    boxShadow: '0 0 12px #00eaff88',
    transition: 'transform 0.2s, box-shadow 0.2s',
  }

  const hoverIn = (e) => {
    e.target.style.transform = 'scale(1.05)'
    e.target.style.boxShadow = '0 0 20px #00ffffcc'
  }

  const hoverOut = (e) => {
    e.target.style.transform = 'scale(1)'
    e.target.style.boxShadow = '0 0 12px #00eaff88'
  }

  return (
    <group position={[0, 5, 0]}>
      {/* 🌀 ホログラムUI（右上にずらして表示） */}
      {showUI && !selected && (
        <Html position={[1.2, 0, 0]} distanceFactor={10}>
          <aWeb.div
            style={{
              opacity: uiOpacity.to((o) => o),
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(0, 255, 255, 0.4)',
              borderRadius: '16px',
              padding: '20px 24px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)',
              color: '#00ffff',
              fontWeight: 'bold',
              textAlign: 'center',
              minWidth: '180px',
            }}
          >
            <p style={{ fontSize: '1.1em', marginBottom: '14px' }}>Select Destination</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => setSelected('white')}
                style={buttonStyle}
                onMouseOver={hoverIn}
                onMouseOut={hoverOut}
              >
                White Gallery
              </button>
              <button
                onClick={() => setSelected('float')}
                style={buttonStyle}
                onMouseOver={hoverIn}
                onMouseOut={hoverOut}
              >
                Float Gallery
              </button>
            </div>
          </aWeb.div>
        </Html>
      )}

      {/* 🔵 中心コアの内核 */}
      <a.mesh>
        <sphereGeometry args={[0.4, 64, 64]} />
        <a.meshStandardMaterial
          map={plasticMap}
          color="#88ccff"
          metalness={0.2}
          roughness={0.4}
          emissive="#88ccff"
          emissiveIntensity={emissiveIntensity}
        />
      </a.mesh>

      {/* 🔷 中心コアの外殻（回転 + 発光） */}
      <a.mesh ref={outerRef}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <a.meshBasicMaterial
          map={tilesMap}
          color="#00ffff"
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </a.mesh>
    </group>
  )
}
