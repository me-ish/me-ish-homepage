import { useMemo } from 'react'
import * as THREE from 'three'

export default function SkyStarsCustom({ count = 1000, radius = 100 }) {
  const positions = useMemo(() => {
    const pos = []
    for (let i = 0; i < count; i++) {
      let x, y, z
      do {
        x = (Math.random() - 0.5) * 2
        y = Math.random()
        z = (Math.random() - 0.5) * 2
      } while (x * x + y * y + z * z > 1)

      x *= radius
      y *= radius
      z *= radius

      pos.push(x, y, z)
    }
    return new Float32Array(pos)
  }, [count, radius])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        sizeAttenuation
        color="white"
        transparent
        opacity={0.5}
      />
    </points>
  )
}
