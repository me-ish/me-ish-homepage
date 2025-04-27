import { useRef, forwardRef } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { TextureLoader, AdditiveBlending } from 'three'
import { Trail } from '@react-three/drei'
import { a, useSpring } from '@react-spring/three'

const Avatar = forwardRef((props, ref) => {
  const internalRef = useRef()
  const combinedRef = ref || internalRef

  const tilesMap = useLoader(TextureLoader, '/textures/Tiles044_BaseColor.jpg')

  // ✅ アニメーションなし：初期値＝最終値
  const { scale, opacity, position, emissiveIntensity } = useSpring({
    scale: [0.1, 0.1, 0.1],
    opacity: 1,
    emissiveIntensity: 1,
    position: [0, 2.5, 0],
    config: { tension: 0, friction: 0 },
  })

  useFrame((state) => {
    if (combinedRef.current) {
      // 浮遊アニメーション
      combinedRef.current.position.y += Math.sin(state.clock.elapsedTime * 2) * 0.002

      // ギャラリー外への移動制限
      const pos = combinedRef.current.position
      const limit = 38.5

      if (pos.x > limit) pos.x = limit
      if (pos.x < -limit) pos.x = -limit
      if (pos.z > limit) pos.z = limit
      if (pos.z < -limit) pos.z = -limit
    }
  })

  return (
    <Trail
      width={1.2}
      color={'lightyellow'}
      length={4}
      attenuation={(t) => t ** 2.2}
    >
      <a.group ref={combinedRef} position={position} scale={scale} {...props}>
        {/* 内核（テクスチャ＋発光） */}
        <mesh>
          <sphereGeometry args={[0.5, 64, 64]} />
          <a.meshStandardMaterial
            map={tilesMap}
            color="#ffffff"
            emissive="#00ffff"
            emissiveIntensity={emissiveIntensity}
            toneMapped={false}
            transparent
            opacity={opacity}
          />
        </mesh>

        {/* 外殻（光のグロー） */}
        <mesh>
          <sphereGeometry args={[0.7, 64, 64]} />
          <meshBasicMaterial
            map={tilesMap}
            color="#00ffff"
            transparent
            opacity={0.6}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </a.group>
    </Trail>
  )
})

export default Avatar

