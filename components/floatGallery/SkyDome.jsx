import { useLoader } from '@react-three/fiber'
import { TextureLoader, BackSide } from 'three'

export default function SkyHalfDome() {
  const skyTexture = useLoader(TextureLoader, '/textures/sky_day.jpg')

  return (
    <mesh
      rotation={[0, 0, 0]}         // ← 回転戻す
      position={[0, 0, 0]}        // ← 高めに設置（視界下に雲が来ない）
    >
      <sphereGeometry args={[300, 64, 64, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshBasicMaterial map={skyTexture} side={BackSide} />
    </mesh>
  )
}
