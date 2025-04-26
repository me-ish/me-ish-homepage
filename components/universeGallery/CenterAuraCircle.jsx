// components/CenterAuraCircle.jsx
import * as THREE from 'three'

export default function CenterAuraCircle() {
  return (
    <mesh
      position={[0, 0.011, 0]} // 床より少し上
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[1.6, 64]} />
      <meshBasicMaterial
        color="#66ffff"
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
