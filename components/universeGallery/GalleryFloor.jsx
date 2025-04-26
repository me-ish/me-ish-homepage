// components/GalleryWaterFloor.jsx
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// --- vertex shader ---
const vertexShader = `
  varying vec2 vUv;
  varying float vWave;

  uniform float uTime;

  void main() {
    vUv = uv;

    vec3 pos = position;

    // 複数の波を合成してZ方向に揺らす
    float wave1 = sin(pos.x * 10.0 + uTime * 2.0) * 0.015;
    float wave2 = cos(pos.y * 14.0 + uTime * 2.5) * 0.01;
    float wave3 = sin((pos.x + pos.y) * 8.0 + uTime * 1.5) * 0.008;

    float totalWave = wave1 + wave2 + wave3;
    pos.z += totalWave;

    vWave = totalWave;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

// --- fragment shader ---
const fragmentShader = `
  varying vec2 vUv;
  varying float vWave;

  void main() {
    // 波による明るさの変化（軽いノイズ感）
    float brightness = 0.3 + vWave * 4.0;
    brightness = clamp(brightness, 0.2, 1.0);

    // ベースの水面色（深めの青緑）
    vec3 baseColor = vec3(0.2, 0.7, 1.0);

    // 疑似的な反射光（上方向に向かって追加）
    float reflectFade = smoothstep(0.0, 0.5, vUv.y);
    vec3 reflectionColor = vec3(0.6, 1.0, 1.0) * reflectFade * 0.2;

    // 合成
    vec3 finalColor = baseColor * brightness + reflectionColor;

    float alpha = 0.7;  // 半透明水面
    gl_FragColor = vec4(finalColor, alpha);
  }
`

// --- component ---
export default function GalleryWaterFloor() {
  const materialRef = useRef()

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh name="floor" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
      <circleGeometry args={[10, 64]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        blending={THREE.NormalBlending}
        uniforms={{
          uTime: { value: 0 }
        }}
      />
    </mesh>
  )
}
