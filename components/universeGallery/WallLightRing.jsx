// components/WallLightRing.jsx
import * as THREE from 'three'

export default function WallLightRing() {
  return (
    <mesh
      position={[0, 2.5, 0]} // 壁の高さ中央
      rotation={[Math.PI / 2, 0, 0]} // 縦リング
    >
      <ringGeometry args={[9.7, 10, 128]} />
      <meshStandardMaterial
        color="#66ffff"
        emissive="#66ffff"
        emissiveIntensity={1}  // ← これでほんのり光らせる
        transparent
        opacity={0.3}           // 光感に応じて調整可
        roughness={0.4}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
