// components/OrbitalParticles.jsx
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function OrbitalParticles({ center = [0, 6, 0] }) {
  const groupRef = useRef()
  const particleCount = 60

  const positions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 1.5 + Math.random() * 1.5
      const height = (Math.random() - 0.5) * 3
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = height
      arr[i * 3 + 2] = Math.sin(angle) * radius
    }
    return arr
  }, [])

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002
    }
  })

  return (
    <group ref={groupRef} position={center}>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            array={positions}
            count={particleCount}
            itemSize={1.5}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          sizeAttenuation
          color={'#aefcff'}
          transparent
          opacity={0.6}
        />
      </points>
    </group>
  )
}
