import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function GalleryPulseRing({ pulseRef }) {
  const ringRef = useRef()
  const activeRef = useRef(false)
  const scaleRef = useRef(1)
  const opacityRef = useRef(0)

  const prevPulse = useRef(0)

  useFrame(() => {
    const pulse = pulseRef.current || 0

    // 脈動が閾値を超えて、前回より増加 → 新たな波発生
    if (pulse > 0.3 && prevPulse.current <= 0.3 && !activeRef.current) {
      activeRef.current = true
      scaleRef.current = 1
      opacityRef.current = 1
    }
    prevPulse.current = pulse

    // 波が発生中なら拡大＆フェード
    if (activeRef.current) {
      scaleRef.current += 0.08  // 拡大スピード
      opacityRef.current -= 0.015 // フェードスピード

      if (opacityRef.current <= 0) {
        activeRef.current = false // 終了
        opacityRef.current = 0
      }

      if (ringRef.current) {
        ringRef.current.scale.set(scaleRef.current, scaleRef.current, scaleRef.current)
        ringRef.current.material.opacity = opacityRef.current
      }
    }
  })

  return (
    <mesh ref={ringRef} position={[0, 0.023, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.5, 0.52, 64]} />
      <meshBasicMaterial
        color="#00ffff"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}
  