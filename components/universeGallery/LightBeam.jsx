// components/LightBeam.jsx
import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function LightBeam() {
  const materialRef = useRef()

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime()
    }
  })

  return (
    <mesh position={[0, 2.5, 0]}>
      {/* 半径0.75、高さ5の開いた円柱（上下なし） */}
      <cylinderGeometry args={[0.75, 0.75, 5, 64, 1, true]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 }
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
uniform float uTime;

void main() {
  // スクロールして下に流れる演出
  float flow = fract((1.0 - vUv.y) - uTime * 0.2);
  float band = smoothstep(0.0, 0.4, abs(flow - 0.5));

  // 高さに応じて透明度をフェード（下→上で alpha 減衰）
  float heightFade = smoothstep(1.0, 0.0, vUv.y);  // 下=1, 上=0

  vec3 color = vec3(0.3, 0.9, 1.0); // コアに近いシアン系
  float alpha = band * 0.3 * heightFade;

  gl_FragColor = vec4(color, alpha);
}


        `}
      />
    </mesh>
  )
}
